import React, { useState, useEffect } from 'react';
import { setQuickstartRepoPath } from '../../services/managementApiService';

const QuickstartRepoSettings = ({ onPathSet, currentPath }) => {
  const [path, setPath] = useState(currentPath || '');
  const [isEditing, setIsEditing] = useState(!currentPath);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPath(currentPath || '');
    setIsEditing(!currentPath);
  }, [currentPath]);

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      await setQuickstartRepoPath(path);
      onPathSet(path);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to set quickstart repo path:', err);
      setError(err.message || 'Failed to set path.');
    } finally {
      setLoading(false);
    }
  };

  const handleBrowse = async () => {
    // This would typically involve a Wails runtime call to open a directory dialog.
    // For now, we'll simulate it or leave it as a placeholder.
    // Example: const selectedPath = await window.go.main.OpenDirectoryDialog();
    alert('Directory browsing is not yet implemented in the UI. Please enter path manually.');
    // If a path is selected, setPath(selectedPath) and call handleSave()
  };

  return (
    <div className="bg-neutral-800 p-4 rounded shadow-md mb-4">
      <h3 className="text-lg font-semibold text-orange-400 mb-2">Quickstart Repository Settings</h3>
      {isEditing ? (
        <div className="flex flex-col space-y-2">
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="Enter path to quickstart repository (e.g., D:/projects/quickstart)"
            className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex space-x-2">
            <button 
              onClick={handleSave} 
              className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400"
              disabled={loading || !path}
            >
              {loading ? 'Saving...' : 'Save Path'}
            </button>
            <button 
              onClick={handleBrowse} 
              className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400"
              disabled={loading}
            >
              Browse
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-gray-300 text-sm">
            Current Path: <span className="font-mono text-green-400">{path || 'Not configured'}</span>
          </p>
          <button 
            onClick={() => setIsEditing(true)} 
            className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400"
          >
            Edit Path
          </button>
        </div>
      )}
    </div>
  );
};

export default QuickstartRepoSettings;
