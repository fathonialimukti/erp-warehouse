import { SelectSearch } from "./SelectSearch";
import { trpcClient } from "../lib/trpc";

type WarehouseOption = {
  id: string;
  code?: string | null;
  name?: string | null;
};

interface WarehouseSelectSearchProps {
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

const WarehouseSelectSearch = ({
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
}: WarehouseSelectSearchProps) => {
  return (
    <SelectSearch<WarehouseOption>
      sourceData={async ({ search, limit: pageLimit }) => {
        const result = await trpcClient.warehouse.warehouse.list.query({
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
      getOptionLabel={(w) => w.name ?? w.code ?? w.id}
      getOptionTextValue={(w) => `${w.name ?? ""} ${w.code ?? ""}`.trim()}
      limit={limit}
    />
  );
};

export { WarehouseSelectSearch };
