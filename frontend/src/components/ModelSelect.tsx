import React from 'react';

interface ModelSelectProps {
  value: string;
  onChange: (value: string) => void;
}

const models = [
  { id: 'grok-beta', name: 'Gork Grok Beta' },
  { id: 'grok-2', name: 'Gork Grok 2' },
  { id: 'grok-2-1212', name: 'Gork Grok 2 1212' },
  { id: 'grok-2-vision-1212', name: 'Gork Grok 2 Vision 1212' },
];

const ModelSelect: React.FC<ModelSelectProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">Model Provider</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ModelSelect;

