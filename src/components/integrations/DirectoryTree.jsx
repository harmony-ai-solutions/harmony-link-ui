import React, { useState, useEffect } from 'react';
import Tree from 'rc-tree';
import 'rc-tree/assets/index.css';

const DirectoryTree = ({ treeData, onSelect, onLoadChildren, selectedPath, loading = false, loadedKeysRef = new Set() }) => {
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [loadedKeys, setLoadedKeys] = useState(new Set());
  const [preserveExpansions, setPreserveExpansions] = useState(new Set());

  // Reset loaded keys when loadedKeysRef changes
  useEffect(() => {
    setLoadedKeys(new Set());
  }, [loadedKeysRef]);

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

      setExpandedKeys(prevKeys => {
        const newKeys = new Set(prevKeys);

        if (shouldAutoExpand) {
          // Auto-expand the root node to show first level
          newKeys.add(treeData.path);
        }

        // Keep any previously expanded nodes that still exist in the new tree
        const filteredKeys = [...newKeys].filter(key => findNodeByKey(treeData, key));
        return filteredKeys;
      });
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

    const isLoaded = loadedKeys.has(node.path);
    const hasChildren = node.isDir && (!node.children || node.children.length === 0) && !isLoaded;

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
      children: node.children && node.children.length > 0 ? node.children.map(convertToTreeData) : (hasChildren ? [] : undefined),
    };

    return treeNode;
  };

  const handleExpand = async (expandedKeys, info) => {
    setExpandedKeys(expandedKeys);

    // Check if we need to load children for this node
    const { node } = info;
    if (node.isLeaf) return;

    const nodePath = node.key;

    // If this node doesn't have children loaded yet and we need to expand it
    if (expandedKeys.includes(nodePath) && onLoadChildren &&
        (!node.children || node.children.length === 0) && !loadedKeys.has(nodePath)) {
      try {
        await onLoadChildren(nodePath);
        setLoadedKeys(prev => new Set(prev).add(nodePath));
      } catch (error) {
        console.error('Failed to load children for', nodePath, error);
        // Remove from expanded keys if loading failed
        setExpandedKeys(prevKeys => prevKeys.filter(key => key !== nodePath));
      }
    }
  };

  const handleSelect = async (selectedKeys, info) => {
    if (selectedKeys.length > 0 && info.node.isLeaf === false) {
      // Only allow selection of directories
      const selectedPath = selectedKeys[0];

      // Auto-expand selected directory
      setExpandedKeys(prevKeys => {
        const newKeys = new Set(prevKeys);
        // Add the selected path if it's not already expanded
        newKeys.add(selectedPath);
        return [...newKeys];
      });

      // Load children if not already loaded
      if (onLoadChildren && !loadedKeys.has(selectedPath)) {
        try {
          await onLoadChildren(selectedPath);
          setLoadedKeys(prev => new Set(prev).add(selectedPath));
        } catch (error) {
          console.error('Failed to load children for selected path', selectedPath, error);
          // Remove from expanded keys if loading failed
          setExpandedKeys(prevKeys => prevKeys.filter(key => key !== selectedPath));
        }
      }

      // Notify parent of selection
      onSelect(selectedPath);
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
