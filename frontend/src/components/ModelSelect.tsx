import React from 'react';

interface ModelSelectProps {
  value: string;
  onChange: (value: string) => void;
}

const models = [
  { id: 'grok-4-1-fast-reasoning', name: 'Grok 4.1 Fast Reasoning' },
  { id: 'grok-4-1-fast-non-reasoning', name: 'Grok 4.1 Fast Non-Reasoning' },
  { id: 'grok-code-fast-1', name: 'Grok Code Fast 1' },
  { id: 'grok-4-fast-reasoning', name: 'Grok 4 Fast Reasoning' },
  { id: 'grok-4-fast-non-reasoning', name: 'Grok 4 Fast Non-Reasoning' },
  { id: 'grok-4-0709', name: 'Grok 4 0709' },
  { id: 'grok-3-mini', name: 'Grok 3 Mini' },
  { id: 'grok-3', name: 'Grok 3' },
  { id: 'grok-2-vision-1212', name: 'Grok 2 Vision 1212' },
  { id: 'grok-2-1212', name: 'Grok 2 1212' },
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

