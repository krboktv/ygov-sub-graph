import { BigInt } from "@graphprotocol/graph-ts"
import { Vote } from "../generated/Contract/Contract"

export let BI_ZERO = BigInt.fromI32(0)
export let BI_ONE = BigInt.fromI32(1)

export function generateVoteId(event: Vote, voteFor: boolean): string {
    let preId = event.params.id.toString() + '-' + event.params.voter.toHexString()
    if (voteFor == true) {
        return preId + '-1'
    }
    return preId + '-0'
}
