import { useState } from 'react';
import { Button, Input, Label, ListBox, Select, Switch, TextArea } from '@heroui/react';
import { useIntl } from 'react-intl';

export type ChatFormField = {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox';
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  options?: { value: string; label: string }[];
};

export type ChatFormSpec = {
  formTitle: string;
  description?: string;
  fields: ChatFormField[];
};

type ChatFormCardProps = {
  spec: ChatFormSpec;
  onSubmit: (values: Record<string, unknown>) => void;
  onCancel: () => void;
};

/** Interactive form card rendered inside the chat from the AI's field spec. */
export const ChatFormCard = ({ spec, onSubmit, onCancel }: ChatFormCardProps) => {
  const intl = useIntl();
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const f of spec.fields) {
      if (f.type === 'checkbox') initial[f.name] = f.defaultValue === true;
      else if (f.defaultValue !== undefined) initial[f.name] = f.defaultValue;
    }
    return initial;
  });
  const [missing, setMissing] = useState<string[]>([]);

  const setValue = (name: string, value: unknown) => setValues((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = () => {
    const gaps = spec.fields
      .filter((f) => {
        if (!f.required) return false;
        const v = values[f.name];
        return v === undefined || v === null || v === '';
      })
      .map((f) => f.name);
    if (gaps.length > 0) {
      setMissing(gaps);
      return;
    }
    onSubmit(values);
  };

  const requiredLabel = (field: ChatFormField) => `${field.label}${field.required ? ' *' : ''}`;
  const missingHint = () => intl.formatMessage({ id: 'ai_chat.form.required', defaultMessage: 'This field is required' });

  return (
    <div className="rounded-lg border border-default-200 bg-default-100 px-3 py-3 my-1">
      <p className="text-sm font-semibold">{spec.formTitle}</p>
      {spec.description && <p className="text-xs text-default-500 mt-0.5">{spec.description}</p>}
      <div className="flex flex-col gap-3 mt-3">
        {spec.fields.map((field) => {
          const isMissing = missing.includes(field.name);
          switch (field.type) {
            case 'textarea':
              return (
                <div key={field.name} className="flex flex-col gap-1">
                  <Label className="text-xs">{requiredLabel(field)}</Label>
                  <TextArea
                    variant="secondary"
                    rows={3}
                    placeholder={field.placeholder}
                    value={(values[field.name] as string) ?? ''}
                    onChange={(e) => setValue(field.name, e.target.value)}
                    aria-label={field.label}
                  />
                  {isMissing && <span className="text-xs text-danger">{missingHint()}</span>}
                </div>
              );
            case 'select':
              return (
                <div key={field.name} className="flex flex-col gap-1">
                  <Label className="text-xs">{requiredLabel(field)}</Label>
                  <Select
                    aria-label={field.label}
                    placeholder={field.placeholder ?? intl.formatMessage({ id: 'ai_chat.form.select_placeholder', defaultMessage: 'Select…' })}
                    value={((values[field.name] as string) || null) as never}
                    onChange={(key) => setValue(field.name, key == null ? undefined : String(key))}
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {(field.options ?? []).map((opt) => (
                          <ListBox.Item key={opt.value} id={opt.value} textValue={opt.label}>
                            {opt.label}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  {isMissing && <span className="text-xs text-danger">{missingHint()}</span>}
                </div>
              );
            case 'checkbox':
              return (
                <Switch
                  key={field.name}
                  size="sm"
                  isSelected={values[field.name] === true}
                  onChange={(isSelected) => setValue(field.name, isSelected)}
                >
                  <span className="text-xs">{field.label}{field.required ? ' *' : ''}</span>
                </Switch>
              );
            default:
              return (
                <div key={field.name} className="flex flex-col gap-1">
                  <Label className="text-xs">{requiredLabel(field)}</Label>
                  <Input
                    variant="secondary"
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    placeholder={field.placeholder}
                    value={values[field.name] == null ? '' : String(values[field.name])}
                    onChange={(e) =>
                      setValue(
                        field.name,
                        field.type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value,
                      )
                    }
                    aria-label={field.label}
                  />
                  {isMissing && <span className="text-xs text-danger">{missingHint()}</span>}
                </div>
              );
          }
        })}
      </div>
      <div className="flex gap-2 justify-end mt-3">
        <Button size="sm" variant="secondary" onPress={onCancel}>
          {intl.formatMessage({ id: 'ai_chat.form.cancel', defaultMessage: 'Cancel' })}
        </Button>
        <Button size="sm" variant="primary" onPress={handleSubmit}>
          {intl.formatMessage({ id: 'ai_chat.form.submit', defaultMessage: 'Submit' })}
        </Button>
      </div>
    </div>
  );
};
