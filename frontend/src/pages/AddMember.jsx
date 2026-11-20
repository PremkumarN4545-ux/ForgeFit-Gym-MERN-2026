import { useNavigate } from 'react-router-dom';
import * as memberService from '../services/memberService';
import { useToast } from '../context/ToastContext.jsx';
import MemberForm from '../components/MemberForm.jsx';
import { PageHeader } from '../components/Feedback.jsx';

export default function AddMember() {
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (payload) => {
    const created = await memberService.createMember(payload);
    toast.success(`${created.fullName} added as ${created.memberId}.`);
    navigate(`/members/${created._id}`);
  };

  return (
    <>
      <PageHeader title="Add member" subtitle="Register a new gym member and assign a membership plan." />
      <MemberForm onSubmit={handleSubmit} submitLabel="Add member" />
    </>
  );
}
