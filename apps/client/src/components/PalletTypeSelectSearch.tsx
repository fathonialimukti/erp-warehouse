import { SelectSearch } from './SelectSearch';
import { trpcClient } from '../lib/trpc';

type PalletTypeOption = {
  id: string;
  code?: string | null;
  name?: string | null;
};

interface PalletTypeSelectSearchProps {
  queryKeyBase: string;
  skuId?: string;
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

const PalletTypeSelectSearch = ({
  queryKeyBase,
  skuId,
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
}: PalletTypeSelectSearchProps) => {
  return (
    <SelectSearch<PalletTypeOption, { skuId?: string }>
      sourceData={async ({ search, limit: pageLimit, dependencies }) => {
        const parentSkuId = dependencies?.skuId?.trim();

        if (!parentSkuId) {
          return { options: [] };
        }

        const result = await trpcClient.sku.palletType.list.query({
          page: 1,
          limit: pageLimit,
          skuId: parentSkuId,
          search: search.trim() || undefined,
        });

        return {
          options: result.data.map((item) => ({
            id: item.id,
            code: item.code,
            name: item.name,
          })),
        };
      }}
      queryKeyBase={queryKeyBase}
      optionsKey="id"
      value={value}
      onChange={onChange}
      dependencies={{ skuId }}
      label={label}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyLabel={emptyLabel}
      loadingLabel={loadingLabel}
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      errorMessage={errorMessage}
      getOptionLabel={(palletType) => palletType.code ?? palletType.id}
      getOptionDescription={(palletType) => palletType.name ?? '-'}
      getOptionTextValue={(palletType) => `${palletType.code ?? palletType.id} ${palletType.name ?? ''}`}
      limit={limit}
    />
  );
};

export { PalletTypeSelectSearch };