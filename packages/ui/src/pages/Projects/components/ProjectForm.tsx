import React, { useState, useEffect } from 'react';
import { Input, Select } from '../../../components/Form';
import { Project } from '../../../types/project';

interface ProjectFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  initialData?: Partial<Project>;
  isLoading?: boolean;
  isEditing?: boolean;
}

export const ProjectForm: React.FC<ProjectFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  isLoading,
  isEditing
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [privacyLevel, setPrivacyLevel] = useState(initialData?.privacyLevel || 'medium');
  const [status, setStatus] = useState(initialData?.status || 'active');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setPrivacyLevel(initialData.privacyLevel || 'medium');
      setStatus(initialData.status || 'active');
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      privacyLevel,
      status
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        label="Project Name"
        value={name}
        onChange={setName}
        placeholder="Enter project name"
        required
        disabled={isLoading}
      />

      <Input
        label="Description"
        value={description}
        onChange={setDescription}
        placeholder="Enter project description"
        required
        disabled={isLoading}
      />

      <Select
        label="Privacy Level"
        value={privacyLevel}
        onChange={setPrivacyLevel}
        options={[
          { value: 'basic', label: 'Basic' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' }
        ]}
        required
        disabled={isLoading}
      />

      {isEditing && (
        <Select
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'paused', label: 'Paused' },
            { value: 'completed', label: 'Completed' }
          ]}
          required
          disabled={isLoading}
        />
      )}

      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-outline"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading}
        >
          {isLoading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Project')}
        </button>
      </div>
    </form>
  );
};
