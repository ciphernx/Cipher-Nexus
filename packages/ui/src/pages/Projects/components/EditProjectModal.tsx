import React from 'react';
import { Modal } from '../../../components/Modal';
import { ProjectForm } from './ProjectForm';
import { Project } from '../../../types/project';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Project>) => void;
  project: Project;
  isLoading?: boolean;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  project,
  isLoading
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Project"
    >
      <ProjectForm
        onSubmit={onSubmit}
        onCancel={onClose}
        initialData={project}
        isLoading={isLoading}
        isEditing
      />
    </Modal>
  );
};
