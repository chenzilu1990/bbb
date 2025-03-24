'use client';

import { useRef, useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// 拖拽项组件
function DraggableImage({ image, index, moveImage, isSelected, selectionIndex, onToggleSelect }) {
  const ref = useRef(null);
  
  const [{ isDragging }, drag] = useDrag({
    type: 'IMAGE',
    item: () => ({ id: image.id, index }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'IMAGE',
    hover: (item, monitor) => {
      if (!ref.current) return;
      
      const dragIndex = item.index;
      const hoverIndex = index;
      
      // 不替换元素自身
      if (dragIndex === hoverIndex) return;
      
      // 确定屏幕上矩形的大小
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      
      // 获取垂直中点
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      
      // 确定鼠标位置
      const clientOffset = monitor.getClientOffset();
      
      // 获取像素点进入
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      
      // 只在鼠标超过一半高度时执行移动
      // 向下拖动时，只有当光标低于50%高度时才移动
      // 向上拖动时，只有当光标高于50%高度时才移动
      
      // 向上拖动
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;
      
      // 向下拖动
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      
      // 执行移动
      moveImage(dragIndex, hoverIndex);
      
      // 注意：我们在这里突变item的索引
      // 通常最好避免突变，但这是一个特例
      item.index = hoverIndex;
    },
  });
  
  // 初始化拖拽和放置引用
  drag(drop(ref));

  useEffect(() => {
    // 释放预览URL以避免内存泄漏
    return () => {
      if (image.preview) URL.revokeObjectURL(image.preview);
    };
  }, [image]);

  const handleClick = (e) => {
    // 防止拖拽事件和点击事件冲突
    if (!isDragging) {
      onToggleSelect(image.id);
    }
  };

  // 获取显示名称（如果有前缀应用则使用displayName）
  const displayName = image.file.displayName || image.file.name;

  return (
    <div 
      ref={ref} 
      className={`image-item ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
    >
      <img 
        src={image.preview} 
        alt={`Preview ${index}`} 
      />
      {isSelected && (
        <div className="selected-indicator">
          <span>{selectionIndex}</span>
        </div>
      )}
      <div className="image-filename">
        {displayName}
      </div>
    </div>
  );
}

// 主图片网格组件
const SortableImageGrid = forwardRef(({ images, setImages, onSelectedChange }, ref) => {
  // 使用Map存储选中的图片和它们的选中顺序
  const [selectedImageMap, setSelectedImageMap] = useState(new Map());

  // 暴露重置选中状态的方法给父组件
  useImperativeHandle(ref, () => ({
    resetSelection: () => {
      // 使用函数式更新确保状态立即更新
      setSelectedImageMap(() => new Map());
      // 通知父组件选择已清空
      if (onSelectedChange) {
        onSelectedChange([]);
      }
    }
  }), [onSelectedChange]);

  // 通知父组件选中的图片ID，按选中顺序排序
  const notifySelectedChange = useCallback((map) => {
    if (onSelectedChange) {
      // 将Map转换为数组并按值(选中顺序)排序
      const entries = Array.from(map.entries());
      entries.sort((a, b) => a[1] - b[1]);
      
      // 返回排序后的ID数组
      const sortedIds = entries.map(entry => entry[0]);
      onSelectedChange(sortedIds);
    }
  }, [onSelectedChange]);

  // 每次selectedImageMap更新时通知父组件
  useEffect(() => {
    notifySelectedChange(selectedImageMap);
  }, [selectedImageMap, notifySelectedChange]);

  const moveImage = useCallback((dragIndex, hoverIndex) => {
    setImages((prevImages) => {
      const updatedImages = [...prevImages];
      [updatedImages[dragIndex], updatedImages[hoverIndex]] = 
      [updatedImages[hoverIndex], updatedImages[dragIndex]];
      return updatedImages;
    });
  }, [setImages]);

  const handleToggleSelect = useCallback((imageId) => {
    setSelectedImageMap(prevMap => {
      // 创建新的Map以避免直接修改状态
      const newMap = new Map(prevMap);
      
      if (newMap.has(imageId)) {
        // 如果已选中，则取消选中
        const removedIndex = newMap.get(imageId);
        newMap.delete(imageId);
        
        // 更新序号大于被移除图片序号的所有图片序号
        newMap.forEach((index, id) => {
          if (index > removedIndex) {
            newMap.set(id, index - 1);
          }
        });
      } else {
        // 如果未选中，则添加到选中列表，并分配下一个序号
        newMap.set(imageId, newMap.size + 1);
      }
      
      return newMap;
    });
  }, []);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="image-grid">
        {images.map((image, index) => (
          <DraggableImage
            key={image.id}
            image={image}
            index={index}
            moveImage={moveImage}
            isSelected={selectedImageMap.has(image.id)}
            selectionIndex={selectedImageMap.get(image.id)}
            onToggleSelect={handleToggleSelect}
          />
        ))}
      </div>
    </DndProvider>
  );
});

SortableImageGrid.displayName = 'SortableImageGrid';

export default SortableImageGrid; 