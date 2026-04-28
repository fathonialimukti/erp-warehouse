import { useIntl } from 'react-intl';
import { Card } from '@heroui/react';
import { Tabs } from "@heroui/react";
import { InboundTransactionTable } from "./inbound/_InboundTransactionTable";
import { OutboundTransactionTable } from "./outbound/_OutboundTransactionTable";
import { FoundTransactionTable } from "./found/_FoundTransactionTable";
import { LostTransactionTable } from "./loss/_LostTransactionTable";

function TransactionsIndexPage() {
  const intl = useIntl();

  return (
    <div>
      <Card.Header>
        <Card.Title className="text-2xl">
          {intl.formatMessage({ id: 'transactionpage_title', defaultMessage: 'Warehouse Transactions' })}
        </Card.Title>
        <Card.Description>
          {intl.formatMessage({
            id: 'transactionpage_description',
            defaultMessage: 'Choose a transaction type to view lists, create records, or open transaction details.',
          })}
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <Tabs className="mt-4">
          <Tabs.ListContainer>
            <Tabs.List
              aria-label="Options"
              className=" *:data-[selected=true]:text-accent-foreground"
            >
              <Tabs.Tab id="inbound">
                {intl.formatMessage({ id: 'transactionpage_tabinbound', defaultMessage: 'Inbound' })}
                <Tabs.Indicator className="bg-accent" />
              </Tabs.Tab>
              <Tabs.Tab id="outbound">
                {intl.formatMessage({ id: 'transactionpage_taboutbound', defaultMessage: 'Outbound' })}
                <Tabs.Indicator className="bg-accent" />
              </Tabs.Tab>
              <Tabs.Tab id="found">
                {intl.formatMessage({ id: 'transactionpage_tabfound', defaultMessage: 'Found' })}
                <Tabs.Indicator className="bg-accent" />
              </Tabs.Tab>
              <Tabs.Tab id="loss">
                {intl.formatMessage({ id: 'transactionpage_tablost', defaultMessage: 'Loss' })}
                <Tabs.Indicator className="bg-accent" />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel className="" id="inbound">
            <InboundTransactionTable></InboundTransactionTable>
          </Tabs.Panel>
          <Tabs.Panel className="" id="outbound">
            <OutboundTransactionTable></OutboundTransactionTable>
          </Tabs.Panel>
          <Tabs.Panel className="" id="found">
            <FoundTransactionTable></FoundTransactionTable>
          </Tabs.Panel>
          <Tabs.Panel className="" id="loss">
            <LostTransactionTable></LostTransactionTable>
          </Tabs.Panel>
        </Tabs>
      </Card.Content>
    </div>
  );
}

export { TransactionsIndexPage };
