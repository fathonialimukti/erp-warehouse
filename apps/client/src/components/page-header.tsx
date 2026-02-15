import { Button } from '@heroui/react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  backTo?: string;
  onBack?: () => void;
}

export const PageHeader = ({ title, backTo, onBack }: PageHeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className='flex items-center justify-between gap-4 mb-6'>
      <h1 className='text-2xl md:text-3xl font-bold text-gray-900'>{title}</h1>
      <Button
        isIconOnly
        aria-label='Kembali'
        variant="ghost"
        onPress={handleBack}>
        <ArrowLeft className='h-5 w-5' />
      </Button>
    </div>
  );
};
