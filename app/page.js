'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import ImageDropzone from './components/ImageDropzone';
import SortableImageGrid from './components/SortableImageGrid';
import JSZip from 'jszip';
import './globals.css';

export default function Home() {
  const [images, setImages] = useState([]);
  const selectedImagesRef = useRef([]);
  const [selectedCount, setSelectedCount] = useState(0);
  const [prefix, setPrefix] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const gridRef = useRef(null);

  // 接收选中图片的回调
  const handleSelectedImagesChange = useCallback((selectedIds) => {
    selectedImagesRef.current = selectedIds;
    setSelectedCount(selectedIds.length);
  }, []);

  const handleImagesDrop = useCallback((newImages) => {
    if (!newImages || !Array.isArray(newImages) || newImages.length === 0) return;
    
    setImages((prevImages) => [...prevImages, ...newImages]);
  }, []);

  const clearImages = useCallback(() => {
    if (images.length === 0) return;
    
    // 释放所有预览URL
    images.forEach(image => {
      if (image && image.preview) URL.revokeObjectURL(image.preview);
    });
    setImages([]);
  }, [images]);

  const downloadOrder = useCallback(() => {
    if (images.length === 0) return;
    
    // 创建文件名列表的文本
    const fileNames = images.map((image, index) => {
      // 如果已有显示名称，则使用它
      if (image.file.displayName) {
        return `${index + 1}. ${image.file.displayName}`;
      }
      
      // 否则使用原始名称
      return `${index + 1}. ${image.file.name}`;
    }).join('\n');
    
    // 创建blob并下载
    const blob = new Blob([fileNames], { type: 'text/plain' });
    const href = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = href;
    link.download = 'image-order.txt';
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  }, [images]);

  // 删除选中的图片
  const deleteSelected = useCallback(() => {
    if (selectedImagesRef.current.length === 0) return;
    
    // 释放被删除图片的预览URL
    const selectedIds = new Set(selectedImagesRef.current);
    const imagesToDelete = images.filter(img => selectedIds.has(img.id));
    
    imagesToDelete.forEach(image => {
      if (image && image.preview) URL.revokeObjectURL(image.preview);
    });
    
    // 过滤掉选中的图片
    setImages(prevImages => 
      prevImages.filter(image => !selectedIds.has(image.id))
    );
    
    // 先重置选中状态，确保UI立即更新
    if (gridRef.current) {
      gridRef.current.resetSelection();
    }
    
  }, [images]);

  // 将图片URL转换为Blob对象
  const urlToBlob = async (url) => {
    const response = await fetch(url);
    const blob = await response.blob();
    return blob;
  };

  // 批量下载选中的图片（打包成ZIP）
  const downloadSelectedImages = useCallback(async () => {
    if (selectedImagesRef.current.length === 0) return;
    
    setIsDownloading(true);
    
    try {
      const selectedIds = new Set(selectedImagesRef.current);
      const selectedImages = images.filter(img => selectedIds.has(img.id));
      
      if (selectedImages.length === 0) {
        setIsDownloading(false);
        return;
      }
      
      // 创建一个新的JSZip实例
      const zip = new JSZip();
      
      // 添加图片到zip
      const promises = selectedImages.map(async (image, index) => {
        // 使用显示名称(如果有)或原始文件名
        const fileName = image.file.displayName || image.file.name;
        
        // 将图片URL转换为Blob
        try {
          const blob = await urlToBlob(image.preview);
          if (!blob) {
            console.error(`无法获取图片Blob: ${fileName}`);
            return;
          }
          zip.file(fileName, blob);
        } catch (error) {
          console.error(`添加图片到ZIP出错: ${fileName}`, error);
        }
      });
      
      // 等待所有图片添加完成
      await Promise.all(promises);
      
      // 检查zip是否为空
      if (Object.keys(zip.files).length === 0) {
        throw new Error('没有可下载的图片');
      }
      
      // 生成ZIP文件
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      if (!zipBlob || zipBlob.size === 0) {
        throw new Error('生成ZIP文件失败');
      }
      
      // 创建下载链接
      const href = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `${prefix || 'images'}_selected.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
    } catch (error) {
      console.error('批量下载图片出错:', error);
      alert(`批量下载图片时出错: ${error.message || '请重试'}`);
    } finally {
      setIsDownloading(false);
    }
  }, [images, prefix]);

  // 应用前缀到选中的图片
  const applyPrefix = useCallback(() => {
    if (selectedImagesRef.current.length === 0 || !prefix.trim()) return;
    
    // 保存当前选中的图片ID，因为之后会重置选择状态
    const selectedIds = [...selectedImagesRef.current];
    
    // 获取选中图片的详细信息及其选中顺序
    const selectedImages = [];
    images.forEach(image => {
      if (selectedIds.includes(image.id)) {
        selectedImages.push(image);
      }
    });
    
    // 根据选中顺序为图片分配类型名称
    setImages(prevImages => {
      const updatedImages = prevImages.map(image => {
        const selectedIndex = selectedIds.indexOf(image.id);
        if (selectedIndex !== -1) {
          let typeName = '';
          
          // 第一张图片为MAIN
          if (selectedIndex === 0) {
            typeName = 'MAIN';
          } 
          // 最后一张图片为SWITCH
          else if (selectedIndex === selectedIds.length - 1) {
            typeName = 'SWITCH';
          } 
          // 中间图片为PT01到PT08
          else {
            const ptIndex = selectedIndex;
            typeName = `PT${String(ptIndex).padStart(2, '0')}`;
          }
          
          // 获取文件扩展名（优先使用已有的displayName，否则使用原始文件名）
          const sourceFileName = image.file.displayName || image.file.name;
          
          // 改进的扩展名提取方法
          let fileExt = '';
          const lastDotIndex = sourceFileName.lastIndexOf('.');
          if (lastDotIndex !== -1 && lastDotIndex > sourceFileName.lastIndexOf('/') && lastDotIndex > sourceFileName.lastIndexOf('\\')) {
            fileExt = sourceFileName.substring(lastDotIndex);
          }
          
          // 创建新的文件对象
          return {
            ...image,
            file: {
              ...image.file,
              displayName: `${prefix}.${typeName}${fileExt}`
            }
          };
        }
        return image;
      });
      
      return updatedImages;
    });
    
    // 状态更新后立即重置选择
    gridRef.current?.resetSelection();
    
  }, [prefix, images]);

  // 组件卸载时清理所有预览URL
  useEffect(() => {
    return () => {
      images.forEach(image => {
        if (image && image.preview) URL.revokeObjectURL(image.preview);
      });
    };
  }, [images]);

  return (
    <main>
      <h1>图片快速排序</h1>
      
      <ImageDropzone onImagesDrop={handleImagesDrop} />
      
      {images.length > 0 ? (
        <>
          <SortableImageGrid 
            ref={gridRef}
            images={images} 
            setImages={setImages} 
            onSelectedChange={handleSelectedImagesChange}
          />
          
          <div className="actions">
            <button onClick={clearImages}>
              清除所有图片
            </button>
            <button onClick={deleteSelected}>
              删除选中图片
            </button>
            <button onClick={downloadOrder}>
              下载排序结果
            </button>
            {selectedCount > 0 && (
              <button 
                onClick={downloadSelectedImages}
                className="highlight-button"
                disabled={isDownloading}
              >
                {isDownloading ? '正在打包...' : '下载选中图片（ZIP）'}
              </button>
            )}
          </div>

          {selectedCount > 0 && (
            <div className="prefix-form">
              <input 
                type="text" 
                placeholder="输入前缀..." 
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                className="prefix-input"
              />
              <button 
                onClick={applyPrefix}
                disabled={!prefix.trim()}
              >
                应用前缀
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-message">
          <p>请拖拽或选择图片以开始排序</p>
        </div>
      )}
    </main>
  );
} 