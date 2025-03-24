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
  const [renamedImages, setRenamedImages] = useState([]);

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
    
    // 获取选中图片及其选中顺序
    const selectedImagesToRename = [];
    images.forEach(image => {
      if (selectedIds.includes(image.id)) {
        const index = selectedIds.indexOf(image.id);
        selectedImagesToRename.push({...image, selectionIndex: index});
      }
    });
    
    // 为选中图片创建重命名副本
    const newRenamedImages = selectedImagesToRename.map(image => {
      const selectedIndex = image.selectionIndex;
      let typeName = '';
      
      // 第一张图片为MAIN
      if (selectedIndex === 0) {
        typeName = 'MAIN';
      } 
      // 最后一张图片为SWITCH
      else if (selectedIndex === selectedImagesToRename.length - 1) {
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
      
      // 创建新名称
      const newDisplayName = `${prefix}.${typeName}${fileExt}`;
      
      // 创建新的图片对象
      return {
        ...image,
        id: `renamed-${image.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // 确保ID唯一
        file: {
          ...image.file,
          displayName: newDisplayName
        },
        isRenamed: true,
        originalImageId: image.id,
        prefix: prefix, // 保存使用的前缀
        applyTime: new Date().toLocaleString() // 保存应用时间，便于识别
      };
    });
    
    // 在现有重命名图片基础上添加新的图片，而不是替换
    setRenamedImages(prevRenamedImages => [...prevRenamedImages, ...newRenamedImages]);
    
    // 状态更新后立即重置选择
    gridRef.current?.resetSelection();
    
  }, [prefix, images]);

  // 下载重命名后的图片
  const downloadRenamedImages = useCallback(async () => {
    if (renamedImages.length === 0) return;
    
    setIsDownloading(true);
    
    try {
      // 创建一个新的JSZip实例
      const zip = new JSZip();
      
      // 添加图片到zip
      const promises = renamedImages.map(async (image, index) => {
        // 使用新的显示名称
        const fileName = image.file.displayName;
        
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
      link.download = `${prefix || 'images'}_renamed.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
    } catch (error) {
      console.error('批量下载重命名图片出错:', error);
      alert(`批量下载重命名图片时出错: ${error.message || '请重试'}`);
    } finally {
      setIsDownloading(false);
    }
  }, [renamedImages, prefix]);

  // 清除重命名的图片
  const clearRenamedImages = useCallback(() => {
    if (renamedImages.length === 0) return;
    
    // 释放预览URL
    renamedImages.forEach(image => {
      if (image && image.preview) URL.revokeObjectURL(image.preview);
    });
    
    setRenamedImages([]);
  }, [renamedImages]);

  // 下载特定组的重命名图片
  const downloadGroupImages = useCallback(async (groupImages, groupPrefix) => {
    if (!groupImages || groupImages.length === 0) return;
    
    setIsDownloading(true);
    
    try {
      // 创建一个新的JSZip实例
      const zip = new JSZip();
      
      // 添加图片到zip
      const promises = groupImages.map(async (image) => {
        // 使用新的显示名称
        const fileName = image.file.displayName;
        
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
      link.download = `${groupPrefix || 'images'}_group.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
    } catch (error) {
      console.error('批量下载组图片出错:', error);
      alert(`批量下载组图片时出错: ${error.message || '请重试'}`);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  // 组件卸载时清理所有预览URL
  useEffect(() => {
    return () => {
      images.forEach(image => {
        if (image && image.preview) URL.revokeObjectURL(image.preview);
      });
    };
  }, [images]);

  // 添加双击事件处理
  useEffect(() => {
    const mainElement = document.querySelector('main');
    
    // 监听双击事件
    const handleDblClick = (e) => {
      // 排除一些不应该触发文件选择的元素
      const isButton = e.target.tagName === 'BUTTON';
      const isInput = e.target.tagName === 'INPUT';
      const isImage = e.target.tagName === 'IMG';
      const isLink = e.target.tagName === 'A';
      
      // 如果不是按钮、输入框、图片或链接，则可以触发文件选择
    //   if (!isButton && !isInput && !isImage && !isLink) {
        // if (window.imageDropzoneRef) {
        //   window.imageDropzoneRef.openFileDialog();
        // }
    //   }
    };
    
    // 为main元素添加双击事件
    if (mainElement) {
      mainElement.addEventListener('dblclick', handleDblClick);
    }
    
    return () => {
      if (mainElement) {
        mainElement.removeEventListener('dblclick', handleDblClick);
      }
    };
  }, []);

  return (
    <main>
      {/* <h1>图片快速排序</h1> */}
      
      {/* 固定在顶部的前缀输入区域 */}
      {selectedCount > 0 && (
        <div className="floating-prefix-form">
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
            className="apply-button"
          >
            应用前缀
          </button>
        </div>
      )}
      
      {/* 取消注释此段代码，恢复dropzone-info提示 */}
      {images.length === 0 && (
        <div className="dropzone-info">
          将图片拖放到页面任意位置，或点击选择图片
        </div>
      )}
      
      {/* 隐藏的图片上传组件，但通过ref暴露方法给整个页面 */}
      <div style={{ display: 'none' }}>
        <ImageDropzone onImagesDrop={handleImagesDrop} ref={(el) => window.imageDropzoneRef = el} />
      </div>
      
      {images.length > 0 ? (
        <>
          <SortableImageGrid 
            ref={gridRef}
            images={images} 
            setImages={setImages} 
            onSelectedChange={handleSelectedImagesChange}
          />
          
          {/* 选中图片预览区 */}
          {selectedCount > 0 && (
            <div className="selected-preview">
              <h3>已选中图片 ({selectedCount})</h3>
              <div className="selected-images-row">
                {images
                  .filter(img => selectedImagesRef.current.includes(img.id))
                  .sort((a, b) => {
                    // 按照选中的顺序排序
                    return selectedImagesRef.current.indexOf(a.id) - selectedImagesRef.current.indexOf(b.id);
                  })
                  .map((image, index) => (
                    <div key={`selected-${image.id}`} className="selected-thumbnail">
                      <img 
                        src={image.preview} 
                        alt={`Selected ${index + 1}`} 
                      />
                      <div className="selected-number">{index + 1}</div>
                      <div className="selected-filename">
                        {image.file.displayName || image.file.name}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
          
          {/* 重命名后的图片展示区 */}
          {renamedImages.length > 0 && (
            <div className="renamed-preview">
              <h3>已重命名图片 ({renamedImages.length})</h3>
              
              {/* 根据应用时间分组显示 */}
              {(() => {
                // 按应用时间分组
                const groupedImages = {};
                renamedImages.forEach(image => {
                  const applyTimeKey = image.applyTime || '未知时间';
                  const prefixKey = image.prefix || '未知前缀';
                  const groupKey = `${prefixKey}-${applyTimeKey}`;
                  
                  if (!groupedImages[groupKey]) {
                    groupedImages[groupKey] = {
                      prefix: prefixKey,
                      applyTime: applyTimeKey,
                      images: []
                    };
                  }
                  
                  groupedImages[groupKey].images.push(image);
                });
                
                // 转换为数组并按时间倒序排列（最近的在前面）
                const groups = Object.values(groupedImages).sort((a, b) => {
                  // 按时间倒序排列
                  return new Date(b.applyTime) - new Date(a.applyTime);
                });
                
                return groups.map((group, groupIndex) => (
                  <div key={`group-${groupIndex}`} className="renamed-group">
                    <div className="renamed-group-header">
                      <span className="renamed-group-prefix">{group.prefix}</span>
                      <span className="renamed-group-time">{group.applyTime}</span>
                      <button 
                        className="group-download-btn"
                        onClick={() => downloadGroupImages(group.images, group.prefix)}
                        disabled={isDownloading}
                      >
                        {isDownloading ? '下载中...' : '下载此组'}
                      </button>
                    </div>
                    <div className="renamed-images-row">
                      {group.images.map((image, index) => (
                        <div key={`renamed-${image.id}`} className="renamed-thumbnail">
                          <img 
                            src={image.preview} 
                            alt={`Renamed ${index + 1}`} 
                          />
                          <div className="renamed-filename">
                            {image.file.displayName}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
              
              <div className="renamed-actions">
                <button onClick={downloadRenamedImages} disabled={isDownloading}>
                  {isDownloading ? '正在打包...' : '下载所有重命名图片'}
                </button>
                <button onClick={clearRenamedImages} className="secondary-button">
                  清除所有重命名图片
                </button>
              </div>
            </div>
          )}
          
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
        </>
      ) : (
        <div className="empty-message">
          {/* <p>请拖拽或选择图片以开始排序</p> */}
        </div>
      )}
    </main>
  );
} 