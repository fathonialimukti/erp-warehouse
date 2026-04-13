import { useIntl } from 'react-intl';
import { Card } from '@heroui/react';
import { Tabs } from "@heroui/react";
import TransaksiMasukTable from "./masuk/_table";
import TransaksiKeluarTable from "./keluar/_table";
import TransaksiTemuanTable from "./temuan/_table";
import TransaksiKehilanganTable from "./kehilangan/_table";

export default function TransaksiIndexPage() {
  const intl = useIntl();

  return (
    <div>
      <Card.Header>
        <Card.Title className="text-2xl">
          {intl.formatMessage({ id: 'transactionPage.title', defaultMessage: 'Warehouse Transactions' })}
        </Card.Title>
        <Card.Description>
          {intl.formatMessage({
            id: 'transactionPage.description',
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
              <Tabs.Tab id="masuk">
                {intl.formatMessage({ id: 'transactionPage.tabInbound', defaultMessage: 'Inbound' })}
                <Tabs.Indicator className="bg-accent" />
              </Tabs.Tab>
              <Tabs.Tab id="keluar">
                {intl.formatMessage({ id: 'transactionPage.tabOutbound', defaultMessage: 'Outbound' })}
                <Tabs.Indicator className="bg-accent" />
              </Tabs.Tab>
              <Tabs.Tab id="temuan">
                {intl.formatMessage({ id: 'transactionPage.tabFound', defaultMessage: 'Found' })}
                <Tabs.Indicator className="bg-accent" />
              </Tabs.Tab>
              <Tabs.Tab id="kehilangan">
                {intl.formatMessage({ id: 'transactionPage.tabLost', defaultMessage: 'Loss' })}
                <Tabs.Indicator className="bg-accent" />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel className="" id="masuk">
            <TransaksiMasukTable></TransaksiMasukTable>
          </Tabs.Panel>
          <Tabs.Panel className="" id="keluar">
            <TransaksiKeluarTable></TransaksiKeluarTable>
          </Tabs.Panel>
          <Tabs.Panel className="" id="temuan">
            <TransaksiTemuanTable></TransaksiTemuanTable>
          </Tabs.Panel>
          <Tabs.Panel className="" id="kehilangan">
            <TransaksiKehilanganTable></TransaksiKehilanganTable>
          </Tabs.Panel>
        </Tabs>
      </Card.Content>
    </div>
  );
}
