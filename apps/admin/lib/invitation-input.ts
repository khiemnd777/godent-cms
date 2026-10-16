export const INVITATION_NAME_LIMIT = 100;
export function invitationNameError(name: string) {
  return !name.trim() || name.length > INVITATION_NAME_LIMIT ? `Họ tên cần từ 1 đến ${INVITATION_NAME_LIMIT} ký tự.` : "";
}
