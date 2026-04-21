export const approvalStatusValues = [
    "DRAFT",
    "PROPOSED",
    "APPROVED",
    "REJECTED",
] as const;

export const approvalRequestStatusValues = [
    "PROPOSED",
    "APPROVED",
    "REJECTED",
] as const;

export const approvalStepActionValues = ["APPROVE", "REJECT", "REVISE", "COMMENT"] as const;

export const mapRequestStatusToApproval = (
    status: typeof approvalRequestStatusValues[number]
) => {
    if (status === "APPROVED") return "APPROVED";
    if (status === "REJECTED") return "REJECTED";
    return "PROPOSED";
};
