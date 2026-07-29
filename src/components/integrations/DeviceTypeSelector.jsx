import React from 'react';
import ThemedSelect from '../widgets/ThemedSelect';

const DeviceTypeSelector = ({ value, onChange, disabled = false }) => {
  const deviceTypes = [
    { label: 'CPU', value: 'cpu' },
    { label: 'NVIDIA', value: 'nvidia' },
    { label: 'AMD', value: 'amd' },
    { label: 'AMD-WSL', value: 'amd-wsl' },
    { label: 'Intel', value: 'intel' },
  ];

  return (
    <div className="bg-neutral-800 p-4 rounded shadow-md mb-4">
      <h3 className="text-lg font-semibold text-orange-400 mb-2">Inference Device</h3>
      <ThemedSelect
        value={value}
        onChange={(val) => onChange(val)}
        options={deviceTypes}
        disabled={disabled}
      />
    </div>
  );
};

export default DeviceTypeSelector;
