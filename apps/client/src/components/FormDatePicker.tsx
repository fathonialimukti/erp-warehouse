import type { ComponentProps } from 'react';
import { Calendar, DateField, DatePicker, FieldError, Label } from '@heroui/react';

type PickerValue = ComponentProps<typeof DatePicker>['value'];
type PickerOnChange = NonNullable<ComponentProps<typeof DatePicker>['onChange']>;

interface FormDatePickerProps {
  label: string;
  value: PickerValue;
  onChange: PickerOnChange;
  isDisabled?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  'aria-label'?: string;
}

const FormDatePicker = ({ label, value, onChange, isDisabled, isRequired, isInvalid, errorMessage, 'aria-label': ariaLabel }: FormDatePickerProps) => (
  <DatePicker
    value={value}
    onChange={onChange}
    isDisabled={isDisabled}
    isRequired={isRequired}
    isInvalid={isInvalid}
    aria-label={ariaLabel ?? label}
  >
    <Label>{label}</Label>
    <DateField.Group fullWidth variant="secondary">
      <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
      <DateField.Suffix>
        <DatePicker.Trigger>
          <DatePicker.TriggerIndicator />
        </DatePicker.Trigger>
      </DateField.Suffix>
    </DateField.Group>
    {isInvalid && errorMessage && <FieldError>{errorMessage}</FieldError>}
    <DatePicker.Popover>
      <Calendar aria-label={ariaLabel ?? label}>
        <Calendar.Header>
          <Calendar.YearPickerTrigger>
            <Calendar.YearPickerTriggerHeading />
            <Calendar.YearPickerTriggerIndicator />
          </Calendar.YearPickerTrigger>
          <Calendar.NavButton slot="previous" />
          <Calendar.NavButton slot="next" />
        </Calendar.Header>
        <Calendar.Grid>
          <Calendar.GridHeader>
            {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
          </Calendar.GridHeader>
          <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
        </Calendar.Grid>
        <Calendar.YearPickerGrid>
          <Calendar.YearPickerGridBody>
            {({ year }) => <Calendar.YearPickerCell year={year} />}
          </Calendar.YearPickerGridBody>
        </Calendar.YearPickerGrid>
      </Calendar>
    </DatePicker.Popover>
  </DatePicker>
);

export { FormDatePicker };
