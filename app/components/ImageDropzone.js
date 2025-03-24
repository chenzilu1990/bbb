'use client';

import { useCallback, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useDropzone } from 'react-dropzone';

const ImageDropzone = forwardRef(({ onImagesDrop }, ref) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    if (!acceptedFiles || !Array.isArray(acceptedFiles) || acceptedFiles.length === 0) return;
    
    setIsProcessing(true);
    
    try {
      // 过滤非图片文件
      const imageFiles = acceptedFiles.filter(file => 
        file && file.type && file.type.startsWith('image/')
      );
      
      if (imageFiles.length === 0) {
        setIsProcessing(false);
        return;
      }
      
      // 为每个文件创建预览URL
      const imagesWithPreview = imageFiles.map(file => ({
        file,
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        preview: URL.createObjectURL(file)
      }));
      
      if (typeof onImagesDrop === 'function') {
        onImagesDrop(imagesWithPreview);
      }
    } catch (error) {
      console.error('处理上传图片时出错:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [onImagesDrop]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/*': []
    },
    disabled: isProcessing,
    noClick: true, // 禁用点击事件，我们会在整个页面处理
    noKeyboard: true // 禁用键盘事件
  });

  // 暴露打开文件选择对话框的方法给父组件
  useImperativeHandle(ref, () => ({
    openFileDialog: open
  }));

  // 为整个页面添加拖拽监听
  useEffect(() => {
    const handlePageDragOver = (e) => {
      e.preventDefault(); // 防止浏览器默认行为
      e.stopPropagation();
      document.body.classList.add('drag-active');
    };

    const handlePageDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // 只有当拖拽离开整个页面时才移除类
      if (!e.relatedTarget || e.relatedTarget === document.body) {
        document.body.classList.remove('drag-active');
      }
    };

    const handlePageDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.body.classList.remove('drag-active');
      
      // 如果有文件，处理它们
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onDrop(Array.from(e.dataTransfer.files));
      }
    };

    // 添加监听器到整个文档
    document.addEventListener('dragover', handlePageDragOver);
    document.addEventListener('dragleave', handlePageDragLeave);
    document.addEventListener('drop', handlePageDrop);
    // document.addEventListener('dblclick', open);
    
    // 点击提示区域时打开文件选择对话框
    const dropzoneInfo = document.querySelector('.dropzone-info');
    if (dropzoneInfo) {
        dropzoneInfo.addEventListener('click', open);
    }
    
    // 清理函数
    return () => {
        document.removeEventListener('dragover', handlePageDragOver);
        document.removeEventListener('dragleave', handlePageDragLeave);
        document.removeEventListener('drop', handlePageDrop);
        // document.removeEventListener('dblclick', open);
      
      if (dropzoneInfo) {
        dropzoneInfo.removeEventListener('click', open);
      }
    };
  }, [onDrop, open]);

  return (
    <div 
      {...getRootProps()}
      className={`dropzone ${isDragActive ? 'active' : ''} ${isProcessing ? 'processing' : ''}`}
    >
      <input {...getInputProps()} />
      {
        isProcessing ? (
          <p>处理图片中...</p>
        ) : isDragActive ? (
          <p>将图片拖放到这里...</p>
        ) : (
          <p>将图片拖放到这里，或点击选择图片</p>
        )
      }
    </div>
  );
});

ImageDropzone.displayName = 'ImageDropzone';

export default ImageDropzone; 