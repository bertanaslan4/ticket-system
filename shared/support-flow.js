export const supportFlows = ['dealer_first', 'contractor_first', 'contractor_only'];
export const customerContactRole = ticket => (ticket.support_flow || 'dealer_first') === 'dealer_first' ? 'dealer' : 'contractor';

export const isCustomerContact = (ticket, user) => ticket.support_chain?.length
  ? !['customer', 'super_admin'].includes(user.role) && ticket.support_chain[0] === user.org_id
  : customerContactRole(ticket) === user.role;

export const adjacentSupportCompanies = ticket => {
  const chain = ticket.support_chain || [];
  const index = chain.indexOf(ticket.owner_org_id);
  return index < 0 ? [] : chain.slice(Math.max(0, index - 1), index + 2);
};

export const previousSupportCompany = ticket => {
  const index = ticket.support_chain?.indexOf(ticket.owner_org_id) ?? -1;
  return index > 0 ? ticket.support_chain[index - 1] : null;
};
