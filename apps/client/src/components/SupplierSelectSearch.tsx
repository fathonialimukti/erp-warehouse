import { SelectSearch } from "./SelectSearch";
import { trpcClient } from "../lib/trpc";

type SupplierOption = {
  id: string;
  code?: string | null;
  name?: string | null;
};

interface SupplierSelectSearchProps {
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

const SupplierSelectSearch = ({
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
}: SupplierSelectSearchProps) => {
  return (
    <SelectSearch<SupplierOption>
      sourceData={async ({ search, limit: pageLimit }) => {
        const result = await trpcClient.supplier.list.query({
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
      getOptionLabel={(s) => s.name ?? s.code ?? s.id}
      getOptionTextValue={(s) => `${s.name ?? ""} ${s.code ?? ""}`.trim()}
      limit={limit}
    />
  );
};

export { SupplierSelectSearch };
