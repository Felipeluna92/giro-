import { requireRiderUser } from '../../lib/auth';
import ResetForm from './reset-form';
export const dynamic='force-dynamic';
export default async function Reset(){await requireRiderUser();return <ResetForm/>}
