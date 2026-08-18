import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import DirectoryTree from './DirectoryTree';
import { listDirectories, getWorkingDirectory, getHomeDirectory } from '../../services/management/systemService.js';

const DirectoryBrowserModal = ({ isOpen, onClose, onPathSelected, initialPath = '' }) => {
  const [currentPath, setCurrentPath] = useState(initialPath || '');
  const [selectedPath, setSelectedPath] = useState('');
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pathInput, setPathInput] = useState(initialPath || '');
  const [nodeLoadingStates, setNodeLoadingStates] = useState(new Set());
  const [availableDrives, setAvailableDrives] = useState([]);
  const [selectedDrive, setSelectedDrive] = useState('');
  const [loadedKeysRef, setLoadedKeysRef] = useState(() => new Set()); // Track loaded keys to reset when changing directories

  // Load directory data when modal opens or path changes
  useEffect(() => {
    if (isOpen && currentPath !== null) {
      loadDirectory(currentPath);
    }
  }, [isOpen, currentPath]);

  // Initialize path input when modal opens
  useEffect(() => {
    if (isOpen) {
      setPathInput(initialPath || '');
      setSelectedPath(initialPath || '');
    }
  }, [isOpen, initialPath]);

  const loadDirectory = async (path) => {
    setLoading(true);
    setError('');

    try {
      const response = await listDirectories(path, true, 2); // Recursive with depth 2

      if (response.success) {
        setTreeData(response.root);

        // Reset loaded keys when changing root directory
        setLoadedKeysRef(new Set());

        // Handle available drives (Windows only)
        if (response.availableDrives && response.availableDrives.length > 0) {
          setAvailableDrives(response.availableDrives);
          if (response.root && response.root.path) {
            const currentDrive = response.availableDrives.find(drive =>
              response.root.path.toLowerCase().startsWith(drive.toLowerCase())
            );
            if (currentDrive) {
              setSelectedDrive(currentDrive);
            }
          }
        } else {
          setAvailableDrives([]);
          setSelectedDrive('');
        }

        if (!selectedPath && response.root) {
          setSelectedPath(response.root.path);
          setPathInput(response.root.path);
        }
      } else {
        setError(response.error || 'Failed to load directory');
        setTreeData(null);
        setAvailableDrives([]);
        setSelectedDrive('');
      }
    } catch (err) {
      console.error('Failed to load directory:', err);
      setError(err.message || 'Failed to load directory');
      setTreeData(null);
      setAvailableDrives([]);
      setSelectedDrive('');
    } finally {
      setLoading(false);
    }
  };

  // Find and update a node in the tree recursively
  const findAndUpdateNode = (node, path, newChildren) => {
    if (node.path === path) {
      node.children = newChildren;
      return true;
    }
    if (node.children) {
      for (const child of node.children) {
        if (findAndUpdateNode(child, path, newChildren)) {
          return true;
        }
      }
    }
    return false;
  };

  // Load children for a specific path (prefetch logic)
  const handleLoadChildren = async (path) => {
    if (nodeLoadingStates.has(path)) {
      return; // Already loading
    }

    setNodeLoadingStates(prev => new Set(prev).add(path));

    try {
      const response = await listDirectories(path, false, 1); // non-recursive, only 1 level

      if (response.success && response.root && response.root.children) {
        setTreeData(prevTreeData => {
          if (!prevTreeData) return prevTreeData;

          const newTreeData = JSON.parse(JSON.stringify(prevTreeData)); // Deep copy
          findAndUpdateNode(newTreeData, path, response.root.children);
          return newTreeData;
        });
      }
    } catch (error) {
      console.error(`Failed to load children for ${path}:`, error);
      throw error;
    } finally {
      setNodeLoadingStates(prev => {
        const newSet = new Set(prev);
        newSet.delete(path);
        return newSet;
      });
    }
  };

  const handleTreeSelect = (path) => {
    setSelectedPath(path);
    setPathInput(path);
  };

  const handlePathInputChange = (e) => {
    setPathInput(e.target.value);
  };

  const handlePathInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleNavigateToPath();
    }
  };

  const handleNavigateToPath = () => {
    if (pathInput && pathInput !== currentPath) {
      setCurrentPath(pathInput);
      setSelectedPath(pathInput);
    }
  };

  const handleSelectPath = () => {
    if (selectedPath) {
      onPathSelected(selectedPath);
      onClose();
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const handleGoUp = () => {
    if (treeData && treeData.path) {
      const path = treeData.path;
      let parentPath;
      
      // Handle Windows paths properly
      if (path.includes('\\')) {
        const parts = path.split('\\').filter(part => part !== '');
        if (parts.length > 1) {
          parentPath = parts.slice(0, -1).join('\\') + '\\';
        } else if (parts.length === 1) {
          parentPath = parts[0] + '\\';
        } else {
          parentPath = '';
        }
      } else {
        // Handle Unix-style paths
        const parts = path.split('/').filter(part => part !== '');
        parentPath = parts.length > 1 ? '/' + parts.slice(0, -1).join('/') : '/';
      }
      
      setCurrentPath(parentPath);
      setPathInput(parentPath);
    }
  };

  const handleGoHome = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await getHomeDirectory();
      if (response.path) {
        setCurrentPath(response.path);
        setPathInput(response.path);
        setSelectedPath(response.path);
      } else {
        setError('Failed to get home directory path');
      }
    } catch (err) {
      console.error('Failed to get home directory:', err);
      setError(err.message || 'Failed to get home directory');
    } finally {
      setLoading(false);
    }
  };

  const handleGoWorkingDir = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await getWorkingDirectory();
      if (response.path) {
        setCurrentPath(response.path);
        setPathInput(response.path);
        setSelectedPath(response.path);
      } else {
        setError('Failed to get working directory path');
      }
    } catch (err) {
      console.error('Failed to get working directory:', err);
      setError(err.message || 'Failed to get working directory');
    } finally {
      setLoading(false);
    }
  };

  const handleDriveSelect = (drive) => {
    setSelectedDrive(drive);
    setCurrentPath(drive);
    setPathInput(drive);
    setSelectedPath(drive);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      {/* Full-screen container with responsive sizing */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto w-full max-w-4xl max-h-[90vh] bg-[var(--color-background-nav)] backdrop-blur-[28px] saturate-[1.5] rounded-[var(--radius-xl)] shadow-[0_0_50px_var(--color-glow-accent-soft),var(--shadow-glass)] border border-[var(--color-border-glass)] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[var(--color-border-glass)]">
            <Dialog.Title className="text-lg font-semibold" style={{ color: 'var(--color-accent-primary)' }}>
              Browse Directory
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-xl font-bold transition-colors duration-200"
            >
              ×
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {/* Path Navigation */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Current Path:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pathInput}
                  onChange={handlePathInputChange}
                  onKeyPress={handlePathInputKeyPress}
                  placeholder="Enter directory path..."
                  className="input-field flex-1 text-sm font-mono"
                />
                <button
                  onClick={handleNavigateToPath}
                  disabled={loading}
                  className="instance-action-btn disabled:opacity-50"
                >
                  Go
                </button>
                <button
                  onClick={handleGoUp}
                  disabled={loading || !treeData}
                  className="instance-action-btn disabled:opacity-50"
                >
                  Up
                </button>
                <button
                  onClick={handleGoWorkingDir}
                  disabled={loading}
                  className="instance-action-btn disabled:opacity-50"
                >
                  Working Dir
                </button>
                <button
                  onClick={handleGoHome}
                  disabled={loading}
                  className="instance-action-btn disabled:opacity-50"
                >
                  Home
                </button>
              </div>
            </div>

            {/* Drive Selection (Windows only) */}
            {availableDrives.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Available Drives:
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableDrives.map((drive) => (
                    <button
                      key={drive}
                      onClick={() => handleDriveSelect(drive)}
                      disabled={loading}
                      className="instance-action-btn disabled:opacity-50"
                      style={
                        selectedDrive === drive
                          ? {
                              background: 'linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-secondary) 100%)',
                              color: '#ffffff',
                              border: 'none',
                            }
                          : {}
                      }
                    >
                      {drive}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mb-4 p-3 rounded border text-sm" style={{
                backgroundColor: 'var(--color-error-bg)',
                borderColor: 'rgba(239, 83, 80, 0.25)',
                color: 'var(--color-error)',
              }}>
                {error}
              </div>
            )}

            {/* Directory Tree */}
            <div className="mb-6">
              <DirectoryTree
                treeData={treeData}
                onSelect={handleTreeSelect}
                onLoadChildren={handleLoadChildren}
                selectedPath={selectedPath}
                loading={loading}
                loadedKeysRef={loadedKeysRef}
              />
            </div>

            {/* Selected Path Display */}
            {selectedPath && (
              <div className="mb-4 p-3 rounded border" style={{
                backgroundColor: 'var(--color-background-surface-translucent)',
                borderColor: 'var(--color-border-glass)',
              }}>
                <div className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Selected Path:</div>
                <div className="font-mono text-sm break-all" style={{ color: 'var(--color-accent-primary)' }}>{selectedPath}</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--color-border-glass)]">
            <button
              onClick={handleCancel}
              className="btn-secondary py-2 px-4 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSelectPath}
              disabled={!selectedPath}
              className="btn-primary py-2 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Select Path
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default DirectoryBrowserModal;
