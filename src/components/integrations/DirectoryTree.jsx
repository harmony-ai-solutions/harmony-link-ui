import React, { useState, useEffect } from 'react';
import Tree from 'rc-tree';
import 'rc-tree/assets/index.css';

const DirectoryTree = ({ treeData, onSelect, selectedPath, loading = false }) => {
  const [expandedKeys, setExpandedKeys] = useState([]);

  // Auto-expand logic when treeData changes
  useEffect(() => {
    if (treeData && treeData.children) {
      const shouldAutoExpand = (
        // Windows drive root (e.g., "C:\")
        /^[A-Z]:\\?$/.test(treeData.path) ||
        // Unix root
        treeData.path === '/' ||
        // Working directory (empty path or just a name without separators)
        (!treeData.path.includes('/') && !treeData.path.includes('\\')) ||
        // Home directory patterns (common home directory paths)
        isHomeDirectoryPath(treeData.path) ||
        // Any directory that should be immediately accessible
        shouldExpandDirectory(treeData.path)
      );
      
      if (shouldAutoExpand) {
        // Auto-expand the root node to show first level
        setExpandedKeys([treeData.path]);
      } else {
        // For other directories, don't auto-expand but keep existing expansions
        setExpandedKeys(prevKeys => {
          // Only keep keys that still exist in the new tree
          return prevKeys.filter(key => findNodeByKey(treeData, key));
        });
      }
    }
  }, [treeData]);

  // Helper function to detect home directory paths
  const isHomeDirectoryPath = (path) => {
    if (!path) return false;
    
    // Common home directory patterns
    const homePatterns = [
      /^\/home\/[^/]+\/?$/,           // Linux: /home/username
      /^\/Users\/[^/]+\/?$/,          // macOS: /Users/username  
      /^C:\\Users\\[^\\]+\\?$/i,      // Windows: C:\Users\username
      /^\/root\/?$/,                  // Linux root user
    ];
    
    return homePatterns.some(pattern => pattern.test(path));
  };

  // Helper function to determine if a directory should be expanded
  const shouldExpandDirectory = (path) => {
    if (!path) return false;
    
    // Expand commonly accessed directories
    const expandPatterns = [
      /^\/usr\/?$/,                   // Unix /usr
      /^\/var\/?$/,                   // Unix /var
      /^\/opt\/?$/,                   // Unix /opt
      /^C:\\Program Files\\?$/i,      // Windows Program Files
      /^C:\\Windows\\?$/i,            // Windows system directory
    ];
    
    return expandPatterns.some(pattern => pattern.test(path));
  };

  // Helper function to find a node by key in the tree
  const findNodeByKey = (node, key) => {
    if (node.path === key) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNodeByKey(child, key);
        if (found) return found;
      }
    }
    return null;
  };

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
