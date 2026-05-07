import OperationalGatePage from './EnterpriseV386V390OperationalGatePage';

type Props = { state: any; locale: 'en' | 'ar'; notify?: (type: 'success' | 'warning' | 'error', message: string) => void };

export default function EnterpriseV390HRGatePage(props: Props) {
  return <OperationalGatePage gateId="hr" {...props} />;
}
