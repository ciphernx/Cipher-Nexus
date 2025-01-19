import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card = ({ children, className = '', onClick }: CardProps) => {
  return (
    <div
      className={`bg-white overflow-hidden shadow rounded-lg ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;
