import { ReactNode } from 'react';
import {
  Input as HeroInput,
  Select as HeroSelect,
  Autocomplete as HeroAutocomplete,
  TextArea as HeroTextarea,
} from '@heroui/react';

// Types for field state
interface FieldState<TData> {
  value: TData;
  meta: {
    errors: any[];
    errorMap: Record<string, any>;
    isTouched: boolean;
    isDirty: boolean;
  };
}

// ============================================================================
// INPUT FIELD
// ============================================================================

export interface InputFieldProps {
  state?: FieldState<any>;
  isRequired?: boolean;
  required?: boolean;
  label?: string;
  description?: string;
  startContent?: ReactNode;
  endContent?: ReactNode;
  onBlur?: () => void;
  onChange?: (value: any) => void;
  errorMessage?: string | false;
  isInvalid?: boolean;
  className?: string;
  type?: string;
  placeholder?: string;
  value?: any;
  isDisabled?: boolean;
  [key: string]: any;
}

export const InputField = ({
  state,
  isRequired,
  required,
  label,
  description,
  startContent,
  endContent,
  onBlur,
  onChange,
  errorMessage,
  isInvalid,
  className,
  type = 'text',
  placeholder,
  value,
  isDisabled,
  ...props
}: InputFieldProps) => {
  const _isTouched = state ? state.meta.isTouched : false;
  const resolvedValue = state ? state.value : value;
  const _resolvedError = state ? state.meta.errors[0] : errorMessage;
  const resolvedOnChange = onChange || (() => {});
  const resolvedOnBlur = onBlur || (() => {});

  return (
    <HeroInput
      className={className}
      description={description}
      endContent={endContent}
      isDisabled={isDisabled}
      isRequired={isRequired || required}
      label={label}
      placeholder={placeholder}
      startContent={startContent}
      type={type}
      value={resolvedValue}
      onBlur={resolvedOnBlur}
      onValueChange={resolvedOnChange}
      {...props}
    />
  );
};

// ============================================================================
// SELECT FIELD
// ============================================================================

export const SelectItem = ({
  children,
  key,
}: {
  children: ReactNode;
  key: string;
}) => <option value={key}>{children}</option>;

export interface SelectFieldProps {
  state?: FieldState<any>;
  isRequired?: boolean;
  required?: boolean;
  label?: string;
  children?: ReactNode;
  selectedKeys?: any[];
  onSelectionChange?: (keys: any) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  errorMessage?: string | false;
  isInvalid?: boolean;
  isDisabled?: boolean;
  value?: any;
  [key: string]: any;
}

export const SelectField = ({
  state,
  isRequired,
  required,
  label,
  children,
  onBlur,
  placeholder,
  className,
  isDisabled,
  value,
  ...props
}: SelectFieldProps) => {
  const _isTouched = state ? state.meta.isTouched : false;
  const resolvedValue = state ? state.value : value;

  return (
    <HeroSelect
      className={className}
      isDisabled={isDisabled}
      isRequired={isRequired || required}
      label={label}
      placeholder={placeholder}
      value={resolvedValue}
      onBlur={onBlur}
      {...props}>
      {children}
    </HeroSelect>
  );
};

// ============================================================================
// AUTOCOMPLETE FIELD
// ============================================================================

export const AutocompleteItem = ({
  children,
  key,
}: {
  children: ReactNode;
  key: string;
}) => <option value={key}>{children}</option>;

export interface AutocompleteFieldProps {
  state?: FieldState<any>;
  isRequired?: boolean;
  required?: boolean;
  label?: string;
  children?: ReactNode;
  selectedKey?: string;
  onSelectionChange?: (key: string | null) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  errorMessage?: string | false;
  isInvalid?: boolean;
  isLoading?: boolean;
  allowsCustomValue?: boolean;
  isDisabled?: boolean;
  value?: any;
  [key: string]: any;
}

export const AutocompleteField = ({
  state,
  isRequired,
  required,
  label,
  children,
  onBlur,
  placeholder,
  className,
  isLoading,
  allowsCustomValue,
  isDisabled,
  value,
  ...props
}: AutocompleteFieldProps) => {
  const _isTouched = state ? state.meta.isTouched : false;
  const resolvedValue = state ? state.value : value;

  return (
    <HeroAutocomplete
      allowsCustomValue={allowsCustomValue}
      className={className}
      isDisabled={isDisabled}
      isLoading={isLoading}
      isRequired={isRequired || required}
      label={label}
      placeholder={placeholder}
      value={resolvedValue}
      onBlur={onBlur}
      {...props}>
      {children}
    </HeroAutocomplete>
  );
};

// ============================================================================
// TEXTAREA FIELD
// ============================================================================

export interface TextareaFieldProps {
  state?: FieldState<any>;
  isRequired?: boolean;
  required?: boolean;
  label?: string;
  onBlur?: () => void;
  onChange?: (value: any) => void;
  errorMessage?: string | false;
  isInvalid?: boolean;
  className?: string;
  placeholder?: string;
  value?: any;
  isDisabled?: boolean;
  minRows?: number;
  maxRows?: number;
  [key: string]: any;
}

export const TextareaField = ({
  state,
  isRequired,
  required,
  label,
  onBlur,
  onChange,
  className,
  placeholder,
  value,
  isDisabled,
  minRows = 4,
  maxRows = 8,
  ...props
}: TextareaFieldProps) => {
  const resolvedValue = state ? state.value : value;
  const resolvedOnChange = onChange || (() => {});

  return (
    <HeroTextarea
      className={className}
      isDisabled={isDisabled}
      isRequired={isRequired || required}
      label={label}
      maxRows={maxRows}
      minRows={minRows}
      placeholder={placeholder}
      value={resolvedValue}
      onBlur={onBlur}
      onValueChange={resolvedOnChange}
      {...props}
    />
  );
};

// ============================================================================
// DATE FIELD (Using HTML input type="date")
// ============================================================================

export interface DateFieldProps {
  state?: FieldState<any>;
  isRequired?: boolean;
  required?: boolean;
  label?: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  errorMessage?: string | false;
  className?: string;
  placeholder?: string;
  value?: string;
  isDisabled?: boolean;
  min?: string;
  max?: string;
}

export const DateField = ({
  state,
  isRequired,
  required,
  label,
  onBlur,
  onChange,
  className,
  placeholder,
  value,
  isDisabled,
  min,
  max,
}: DateFieldProps) => {
  const resolvedValue = state ? state.value : value;

  return (
    <div className={`flex flex-col gap-2 ${className || ''}`}>
      {label && (
        <label className='text-sm font-medium'>
          {label}
          {isRequired || required ? (
            <span className='text-danger'> *</span>
          ) : null}
        </label>
      )}
      <input
        className='px-3 py-2 border rounded-lg text-sm disabled:opacity-50'
        disabled={isDisabled}
        max={max}
        min={min}
        placeholder={placeholder}
        type='date'
        value={resolvedValue || ''}
        onBlur={onBlur}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const getFieldError = (
  fieldName: string,
  errors: Record<string, any>,
): string | undefined => {
  if (!errors[fieldName]) return undefined;
  const error = errors[fieldName];
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return String(error);
};
