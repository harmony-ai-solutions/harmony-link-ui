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
      <div className="card-compact">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-text-primary">Quickstart Repository Settings</h3>
          <button
            onClick={handleOpenGitHub}
            disabled={githubLoading}
            className="btn-primary text-sm py-1.5 px-3 disabled:opacity-50"
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
              className="input-field w-full"
            />
            {error && <p className="text-status-error text-sm">{error}</p>}
            <div className="flex space-x-2">
              <button 
                onClick={handleSave} 
                className="btn-primary"
                disabled={loading || !path}
              >
                {loading ? 'Saving...' : 'Save Path'}
              </button>
              <button 
                onClick={handleBrowse} 
                className="btn-secondary"
                disabled={loading}
              >
                Browse
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm font-medium text-text-secondary flex-shrink-0">Current Path:</span>
              <input
                type="text"
                value={path || 'Not configured'}
                disabled
                className="input-field flex-1 font-mono text-sm opacity-90 cursor-default"
                style={{ color: 'var(--color-status-success)' }}
              />
            </div>
            <button 
              onClick={() => setIsEditing(true)} 
              className="btn-secondary flex-shrink-0"
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
