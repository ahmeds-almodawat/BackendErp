import OperationalGatePage from './EnterpriseV386V390OperationalGatePage';

type Props = { state: any; locale: 'en' | 'ar'; notify?: (type: 'success' | 'warning' | 'error', message: string) => void };

export default function EnterpriseV387SalesGatePage(props: Props) {
  return <OperationalGatePage gateId="sales" {...props} />;
}
