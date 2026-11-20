import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as memberService from '../services/memberService';
import { getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext.jsx';
import MemberForm from '../components/MemberForm.jsx';
import { ErrorState, PageHeader, PageLoader } from '../components/Feedback.jsx';

export default function EditMember() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [member, setMember] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    memberService.getMember(id).then((m) => !ignore && setMember(m)).catch((err) => !ignore && setError(getErrorMessage(err)));
    return () => {
      ignore = true;
    };
  }, [id]);

  const handleSubmit = async (payload) => {
    const updated = await memberService.updateMember(id, payload);
    toast.success(`${updated.fullName} was updated.`);
    navigate(`/members/${id}`);
  };

  if (error) return <ErrorState message={error} onRetry={() => navigate('/members')} />;
  if (!member) return <PageLoader label="Loading member..." />;

  return (
    <>
      <PageHeader title={`Edit ${member.fullName}`} subtitle={`Member ID ${member.memberId}`} />
      <MemberForm member={member} onSubmit={handleSubmit} submitLabel="Save changes" />
    </>
  );
}
