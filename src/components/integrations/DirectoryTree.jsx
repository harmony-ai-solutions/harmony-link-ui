import React, { useState } from 'react';
import Tree from 'rc-tree';
import 'rc-tree/assets/index.css';

const DirectoryTree = ({ treeData, onSelect, selectedPath, loading = false }) => {
  const [expandedKeys, setExpandedKeys] = useState([]);

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
    <div className="directory-tree bg-neutral-800 p-4 rounded border border-neutral-600 max-h-96 overflow-auto">
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
      <style jsx>{`
        .directory-tree :global(.rc-tree) {
          background: transparent;
          color: #f5f5f5;
        }
        
        .directory-tree :global(.rc-tree-node-content-wrapper) {
          color: #f5f5f5;
          padding: 2px 4px;
          border-radius: 4px;
        }
        
        .directory-tree :global(.rc-tree-node-content-wrapper:hover) {
          background-color: #404040;
        }
        
        .directory-tree :global(.rc-tree-node-content-wrapper.rc-tree-node-selected) {
          background-color: #fb923c;
          color: #000;
        }
        
        .directory-tree :global(.rc-tree-switcher) {
          color: #f5f5f5;
        }
        
        .directory-tree :global(.rc-tree-indent-unit) {
          width: 16px;
        }
        
        .directory-tree :global(.rc-tree-treenode) {
          padding: 2px 0;
        }
        
        .directory-tree :global(.rc-tree-child-tree) {
          display: block;
        }
        
        .directory-tree :global(.rc-tree-treenode-disabled) {
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default DirectoryTree;
