import React, { useState, useEffect } from 'react';
import Tree from 'rc-tree';
import 'rc-tree/assets/index.css';

const DirectoryTree = ({ treeData, onSelect, selectedPath, loading = false }) => {
  const [expandedKeys, setExpandedKeys] = useState([]);

  // Auto-expand first level when at top level (drive roots, etc.)
  useEffect(() => {
    if (treeData && treeData.children) {
      const isTopLevel = treeData.path && (
        // Windows drive root (e.g., "C:\")
        /^[A-Z]:\\?$/.test(treeData.path) ||
        // Unix root
        treeData.path === '/' ||
        // Working directory (empty path or just a name without separators)
        !treeData.path.includes('/') && !treeData.path.includes('\\')
      );
      
      if (isTopLevel) {
        // Auto-expand the root node to show first level
        setExpandedKeys([treeData.path]);
      }
    }
  }, [treeData]);

  // Convert our directory structure to rc-tree format
  const convertToTreeData = (node) => {
    if (!node) return [];

    const treeNode = {
      key: node.path,
      title: (
        <span className="flex items-center">
          <span className="mr-2">
            {node.isDir ? '📁' : '📄'}
          </span>
          <span className="text-neutral-100">{node.name}</span>
        </span>
      ),
      isLeaf: !node.isDir,
      children: node.children ? node.children.map(convertToTreeData) : undefined,
    };

    return treeNode;
  };

  const handleExpand = (expandedKeys) => {
    setExpandedKeys(expandedKeys);
  };

  const handleSelect = (selectedKeys, info) => {
    if (selectedKeys.length > 0 && info.node.isLeaf === false) {
      // Only allow selection of directories
      onSelect(selectedKeys[0]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-neutral-400">Loading directory structure...</div>
      </div>
    );
  }

  if (!treeData) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-neutral-400">No directory data available</div>
      </div>
    );
  }

  const treeNodes = [convertToTreeData(treeData)];

  return (
    <div className="directory-tree custom-scrollbar bg-neutral-800 p-4 rounded border border-neutral-600 max-h-80 overflow-auto">
      <Tree
        treeData={treeNodes}
        expandedKeys={expandedKeys}
        selectedKeys={selectedPath ? [selectedPath] : []}
        onExpand={handleExpand}
        onSelect={handleSelect}
        showLine={true}
        showIcon={false}
        className="custom-tree"
      />
    </div>
  );
};

export default DirectoryTree;
