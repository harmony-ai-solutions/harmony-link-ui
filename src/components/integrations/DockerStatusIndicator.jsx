import React from 'react';

const DockerStatusIndicator = ({ dockerStatus }) => {
  const formatLastCheck = (lastCheck) => {
    if (!lastCheck) return 'Never';
    const date = new Date(lastCheck);
    return date.toLocaleTimeString();
  };

  const getDockerStatusColor = () => {
    if (dockerStatus.available) return 'text-green-400';
    return 'text-red-400';
  };

  const getDockerStatusText = () => {
    if (dockerStatus.available) return 'Available';
    if (dockerStatus.hasClient) return 'Daemon Unavailable';
    return 'Not Available';
  };

  return (
    <div className="p-3 bg-neutral-800 rounded-lg border border-neutral-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-neutral-300">Docker Status:</span>
          <span className={`text-sm font-semibold ${getDockerStatusColor()}`}>
            {getDockerStatusText()}
          </span>
          <span className="text-xs text-neutral-500">
            Last checked: {formatLastCheck(dockerStatus.lastCheck)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DockerStatusIndicator;
