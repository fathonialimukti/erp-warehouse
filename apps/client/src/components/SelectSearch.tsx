import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FieldError,
  Label,
  ListBox,
  SearchField,
  Select,
  Spinner,
} from '@heroui/react';

type SelectSearchQueryParams<TDependencies> = {
  search: string;
  limit: number;
  dependencies?: TDependencies;
};

type SelectSearchSourceResult<TOption> = {
  options: TOption[];
};

type SelectSearchSourceData<TOption, TDependencies> = (
  params: SelectSearchQueryParams<TDependencies>,
) => Promise<SelectSearchSourceResult<TOption> | TOption[]>;

interface SelectSearchProps<TOption extends Record<string, unknown>, TDependencies = Record<string, unknown>> {
  sourceData: SelectSearchSourceData<TOption, TDependencies>;
  optionsKey: keyof TOption;
  value?: string;
  onChange: (value: string) => void;
  queryKeyBase: string;
  dependencies?: TDependencies;
  selectedOption?: TOption | null;
  getOptionLabel?: (option: TOption) => string;
  getOptionDescription?: (option: TOption) => string | undefined;
  getOptionTextValue?: (option: TOption) => string;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  loadingLabel?: string;
  ariaLabel?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  debounceMs?: number;
  limit?: number;
}

const normalizeSourceResult = <TOption,>(data: SelectSearchSourceResult<TOption> | TOption[]): TOption[] => {
  if (Array.isArray(data)) {
    return data;
  }

  return data.options;
};

const getDefaultLabel = <TOption extends Record<string, unknown>>(option: TOption, optionsKey: keyof TOption) => {
  const rawValue = option[optionsKey];
  return rawValue == null ? '' : String(rawValue);
};

const useDebouncedValue = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [delay, value]);

  return debouncedValue;
};

const SelectSearch = <TOption extends Record<string, unknown>, TDependencies = Record<string, unknown>>({
  sourceData,
  optionsKey,
  value,
  onChange,
  queryKeyBase,
  dependencies,
  selectedOption,
  getOptionLabel,
  getOptionDescription,
  getOptionTextValue,
  label,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  loadingLabel,
  ariaLabel,
  isDisabled,
  isInvalid,
  errorMessage,
  debounceMs = 250,
  limit = 50,
}: SelectSearchProps<TOption, TDependencies>) => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm, debounceMs);

  useEffect(() => {
    setSearchTerm('');
  }, [dependencies]);

  const { data, isLoading } = useQuery({
    queryKey: [queryKeyBase, debouncedSearchTerm, dependencies, limit],
    queryFn: async () => {
      const result = await sourceData({
        search: debouncedSearchTerm,
        limit,
        dependencies,
      });

      return normalizeSourceResult(result);
    },
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const options = data ?? [];

  const selected = useMemo(() => {
    if (!value) {
      return null;
    }

    if (selectedOption && String(selectedOption[optionsKey] ?? '') === value) {
      return selectedOption;
    }

    return options.find((option) => String(option[optionsKey] ?? '') === value) ?? null;
  }, [options, optionsKey, selectedOption, value]);

  const renderOptionLabel = (option: TOption) => {
    if (getOptionLabel) {
      return getOptionLabel(option);
    }

    return getDefaultLabel(option, optionsKey);
  };

  return (
    <>
      <Select
        fullWidth
        value={value || undefined}
        onChange={(next) => onChange(String(next ?? ''))}
        variant="secondary"
        isDisabled={isDisabled}
        isInvalid={isInvalid}
        placeholder={placeholder}
        aria-label={ariaLabel}
      >
        {label ? <Label>{label}</Label> : null}
        <Select.Trigger>
          <Select.Value>
            {({ defaultChildren }) => {
              if (!selected) {
                return defaultChildren;
              }

              return renderOptionLabel(selected);
            }}
          </Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <div className="px-3 pt-3">
            <SearchField
              name={`${queryKeyBase}-search`}
              variant="secondary"
              value={searchTerm}
              onChange={setSearchTerm}
              autoFocus
              aria-label={searchPlaceholder}
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder={searchPlaceholder} />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </div>
          <ListBox
            renderEmptyState={() => {
              if (isLoading) {
                return (
                  <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted">
                    <Spinner size="sm" />
                    {loadingLabel ?? 'Loading...'}
                  </div>
                );
              }

              return <span>{emptyLabel ?? 'No options found'}</span>;
            }}
          >
            {options.map((option) => {
              const optionId = String(option[optionsKey] ?? '');
              const description = getOptionDescription?.(option);
              const textValue = getOptionTextValue?.(option) ?? renderOptionLabel(option);

              return (
                <ListBox.Item key={optionId} id={optionId} textValue={textValue}>
                  <div className="flex flex-col">
                    <Label>{renderOptionLabel(option)}</Label>
                    {description ? <span className="text-xs text-muted">{description}</span> : null}
                  </div>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              );
            })}
          </ListBox>
        </Select.Popover>
      </Select>
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </>
  );
};

export { SelectSearch };
export type { SelectSearchSourceData, SelectSearchSourceResult, SelectSearchQueryParams };