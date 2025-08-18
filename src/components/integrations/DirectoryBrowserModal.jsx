import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import DirectoryTree from './DirectoryTree';
import { listDirectories } from '../../services/management/systemService.js';

const DirectoryBrowserModal = ({ isOpen, onClose, onPathSelected, initialPath = '' }) => {
  const [currentPath, setCurrentPath] = useState(initialPath || '');
  const [selectedPath, setSelectedPath] = useState('');
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pathInput, setPathInput] = useState(initialPath || '');

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
        if (!selectedPath && response.root) {
          setSelectedPath(response.root.path);
          setPathInput(response.root.path);
        }
      } else {
        setError(response.error || 'Failed to load directory');
        setTreeData(null);
      }
    } catch (err) {
      console.error('Failed to load directory:', err);
      setError(err.message || 'Failed to load directory');
      setTreeData(null);
    } finally {
      setLoading(false);
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
      const parentPath = treeData.path.split(/[/\\]/).slice(0, -1).join('/') || '/';
      setCurrentPath(parentPath);
      setPathInput(parentPath);
    }
  };

  const handleGoHome = () => {
    setCurrentPath('');
    setPathInput('');
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-4xl w-full bg-neutral-900 rounded-lg shadow-xl border border-neutral-700">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-neutral-700">
            <Dialog.Title className="text-lg font-semibold text-orange-400">
              Browse Directory
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-200 text-xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Path Navigation */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Current Path:
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={pathInput}
                  onChange={handlePathInputChange}
                  onKeyPress={handlePathInputKeyPress}
                  placeholder="Enter directory path..."
                  className="flex-1 bg-neutral-800 border border-neutral-600 text-neutral-100 px-3 py-2 rounded focus:outline-none focus:border-orange-400"
                />
                <button
                  onClick={handleNavigateToPath}
                  disabled={loading}
                  className="bg-neutral-700 hover:bg-neutral-600 text-orange-400 px-4 py-2 rounded disabled:opacity-50"
                >
                  Go
                </button>
                <button
                  onClick={handleGoUp}
                  disabled={loading || !treeData}
                  className="bg-neutral-700 hover:bg-neutral-600 text-orange-400 px-4 py-2 rounded disabled:opacity-50"
                >
                  Up
                </button>
                <button
                  onClick={handleGoHome}
                  disabled={loading}
                  className="bg-neutral-700 hover:bg-neutral-600 text-orange-400 px-4 py-2 rounded disabled:opacity-50"
                >
                  Home
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-300">
                {error}
              </div>
            )}

            {/* Directory Tree */}
            <div className="mb-6">
              <DirectoryTree
                treeData={treeData}
                onSelect={handleTreeSelect}
                selectedPath={selectedPath}
                loading={loading}
              />
            </div>

            {/* Selected Path Display */}
            {selectedPath && (
              <div className="mb-4 p-3 bg-neutral-800 border border-neutral-600 rounded">
                <div className="text-sm text-neutral-300 mb-1">Selected Path:</div>
                <div className="font-mono text-green-400 break-all">{selectedPath}</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-neutral-700">
            <button
              onClick={handleCancel}
              className="bg-neutral-700 hover:bg-neutral-600 text-neutral-300 px-4 py-2 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleSelectPath}
              disabled={!selectedPath}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
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
