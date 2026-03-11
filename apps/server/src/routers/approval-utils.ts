export const statusApprovalValues = [
    "DRAFT",
    "MENUNGGU",
    "DISETUJUI",
    "DITOLAK",
    "BATAL",
] as const;

export const approvalRequestStatusValues = [
    "PENDING",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
] as const;

export const approvalStepActionValues = ["APPROVE", "REJECT", "REVISE", "COMMENT"] as const;

export const mapRequestStatusToApproval = (
    status: typeof approvalRequestStatusValues[number]
) => {
    if (status === "APPROVED") return "DISETUJUI";
    if (status === "REJECTED") return "DITOLAK";
    if (status === "CANCELLED") return "BATAL";
    return "MENUNGGU";
};
