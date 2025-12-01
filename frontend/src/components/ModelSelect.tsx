import React from 'react';

interface ModelSelectProps {
  value: string;
  onChange: (value: string) => void;
}

const models = [
  { id: 'gpt-4o-mini', name: 'OpenAI GPT-4o Mini' },
  { id: 'llama-3-70b-8192', name: 'Groq Llama 3 70B' }, // Groq specific model ID
  { id: 'deepseek-chat', name: 'DeepSeek Chat' },
  { id: 'claude-3-sonnet-20240229', name: 'Anthropic Claude 3 Sonnet' },
  { id: 'moonshot-v1-32k', name: 'Moonshot v1 32k' },
  { id: 'sao10k/l3.1-euryale-70b', name: 'OpenRouter Sao10K Llama 3.1 70B v2.2' },
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

