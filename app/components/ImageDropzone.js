'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

export default function ImageDropzone({ onImagesDrop }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;
    
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': []
    },
    disabled: isProcessing
  });

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
} 