import React from 'react';

const DockerStatusIndicator = ({ dockerStatus }) => {
  const formatLastCheck = (lastCheck) => {
    if (!lastCheck) return 'Never';
    const date = new Date(lastCheck);
    return date.toLocaleTimeString();
  };

  const getDockerStatusStyle = () => {
    if (dockerStatus.available) {
      return {
        text: 'Available',
        color: 'var(--color-status-success)',
        bgColor: 'var(--color-success-bg)',
        borderColor: 'var(--color-success-bg)'
      };
    }
    return {
      text: dockerStatus.hasClient ? 'Daemon Unavailable' : 'Not Available',
      color: 'var(--color-status-error)',
      bgColor: 'var(--color-error-bg)',
      borderColor: 'var(--color-error-bg)'
    };
  };

  const statusStyle = getDockerStatusStyle();

  return (
    <div className="card-compact flex items-center space-x-3">
      <span className="text-sm font-medium text-text-secondary">Docker:</span>
      <span 
        className="status-badge"
        style={{
          color: statusStyle.color,
          backgroundColor: statusStyle.bgColor,
          borderColor: statusStyle.borderColor
        }}
      >
        {statusStyle.text}
      </span>
      <span className="text-xs text-text-muted">
        {formatLastCheck(dockerStatus.lastCheck)}
      </span>
    </div>
  );
};

export default DockerStatusIndicator;
