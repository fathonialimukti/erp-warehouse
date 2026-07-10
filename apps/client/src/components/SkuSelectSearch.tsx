import { SelectSearch } from './SelectSearch';
import { trpcClient } from '../lib/trpc';

type SkuOption = {
  id: string;
  code?: string | null;
  name?: string | null;
};

interface SkuSelectSearchProps {
  queryKeyBase: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  loadingLabel?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  limit?: number;
}

const SkuSelectSearch = ({
  queryKeyBase,
  value,
  onChange,
  label,
  ariaLabel,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  loadingLabel,
  isDisabled,
  isInvalid,
  errorMessage,
  limit = 50,
}: SkuSelectSearchProps) => {
  return (
    <SelectSearch<SkuOption>
      sourceData={async ({ search, limit: pageLimit }) => {
        const result = await trpcClient.sku.list.query({
          page: 1,
          limit: pageLimit,
          search: search.trim() || undefined,
        });

        return { options: result.data };
      }}
      queryKeyBase={queryKeyBase}
      optionsKey="id"
      value={value}
      onChange={onChange}
      label={label}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyLabel={emptyLabel}
      loadingLabel={loadingLabel}
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      errorMessage={errorMessage}
      getOptionDescription={(sku) => sku.name ?? '-'}
      getOptionLabel={(sku) => sku.code ?? sku.id}
      getOptionTextValue={(sku) => `${sku.code ?? sku.id} ${sku.name ?? ''}`}
      limit={limit}
    />
  );
};

export { SkuSelectSearch };