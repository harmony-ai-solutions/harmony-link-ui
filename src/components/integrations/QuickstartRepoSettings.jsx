import React, { useState, useEffect } from 'react';
import { setQuickstartRepoPath } from '../../services/management/integrationsService.js';
import DirectoryBrowserModal from './DirectoryBrowserModal';
import {openSystemUrl} from "../../services/management/systemService.js";

const QuickstartRepoSettings = ({ onPathSet, currentPath }) => {
  const [path, setPath] = useState(currentPath || '');
  const [isEditing, setIsEditing] = useState(!currentPath);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDirectoryBrowser, setShowDirectoryBrowser] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);

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

  const handleBrowse = () => {
    setShowDirectoryBrowser(true);
  };

  const handlePathSelected = (selectedPath) => {
    setPath(selectedPath);
    setShowDirectoryBrowser(false);
  };

  const handleOpenGitHub = async () => {
    setGithubLoading(true);
    try {
      await openSystemUrl('https://github.com/harmony-ai-solutions/quickstart');
    } catch (err) {
      console.error('Failed to open GitHub repository:', err);
      setError(err.message || 'Failed to open GitHub repository.');
    } finally {
      setGithubLoading(false);
    }
  };

  return (
    <>
      <div className="bg-neutral-800 p-4 rounded shadow-md mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-orange-400">Quickstart Repository Settings</h3>
          <button
            onClick={handleOpenGitHub}
            disabled={githubLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm disabled:opacity-50"
            title="Open GitHub repository in browser"
          >
            {githubLoading ? 'Opening...' : '📂 GitHub Repo'}
          </button>
        </div>
        
        {isEditing ? (
          <div className="flex flex-col space-y-2">
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="Enter path to quickstart repository (e.g., D:/projects/quickstart)"
              className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100 px-3 py-2 rounded"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex space-x-2">
              <button 
                onClick={handleSave} 
                className="bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded"
                disabled={loading || !path}
              >
                {loading ? 'Saving...' : 'Save Path'}
              </button>
              <button 
                onClick={handleBrowse} 
                className="bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded"
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
              className="bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded"
            >
              Edit Path
            </button>
          </div>
        )}
      </div>

      {/* Directory Browser Modal */}
      <DirectoryBrowserModal
        isOpen={showDirectoryBrowser}
        onClose={() => setShowDirectoryBrowser(false)}
        onPathSelected={handlePathSelected}
        initialPath={path}
      />
    </>
  );
};

export default QuickstartRepoSettings;
