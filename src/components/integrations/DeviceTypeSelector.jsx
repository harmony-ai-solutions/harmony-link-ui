import React from 'react';

const DeviceTypeSelector = ({ value, onChange }) => {
  const deviceTypes = [
    { label: 'CPU', value: 'cpu' },
    { label: 'NVIDIA', value: 'nvidia' },
    { label: 'AMD', value: 'amd' },
    { label: 'Intel', value: 'intel' },
  ];

  return (
    <div className="bg-neutral-800 p-4 rounded shadow-md mb-4">
      <h3 className="text-lg font-semibold text-orange-400 mb-2">Inference Device</h3>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
      >
        {deviceTypes.map((device) => (
          <option key={device.value} value={device.value}>
            {device.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default DeviceTypeSelector;
