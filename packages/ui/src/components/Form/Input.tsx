import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input: React.FC<InputProps> = ({ error, className = '', ...props }) => {
  return (
    <div>
      <input
        className={`
          appearance-none relative block w-full px-3 py-2 border border-gray-300
          placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500
          focus:border-blue-500 focus:z-10 sm:text-sm
          ${error ? 'border-red-500' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
};

export default Input;
