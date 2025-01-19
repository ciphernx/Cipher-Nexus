import React from 'react';

export const TestInput: React.FC = () => {
  const [value, setValue] = React.useState('');

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Test input"
      className="border p-2 rounded"
    />
  );
};
