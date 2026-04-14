export const approvalStatusValues = [
    "DRAFT",
    "PENDING",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
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
    if (status === "APPROVED") return "APPROVED";
    if (status === "REJECTED") return "REJECTED";
    if (status === "CANCELLED") return "CANCELLED";
    return "PENDING";
};
