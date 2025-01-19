import React from 'react';

interface InputProps {
  label: string;
  type?: 'text' | 'password' | 'email' | 'number';
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  required = false,
  disabled = false
}) => {
  return (
    <div className="form-field">
      <label className="form-label">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`form-input ${error ? 'border-red-500' : 'border-gray-300'} ${
          disabled ? 'bg-gray-100' : ''
        }`}
        required={required}
        disabled={disabled}
      />
      {error && <span className="error-message">{error}</span>}
    </div>
  );
};
