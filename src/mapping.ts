import { store } from '@graphprotocol/graph-ts'
import {
    NewProposal,
    ProposalFinished,
    RegisterVoter,
    RevokeVoter,
    Staked,
    Vote,
    Withdrawn
} from '../generated/Contract/Contract'
import { Proposal, TotalWeight, Vote as VoteEntity, Voter } from '../generated/schema'
import { BI_ONE, BI_ZERO, generateVoteId } from './helpers'

export function handleNewProposal(event: NewProposal): void {
    let entity = new Proposal(event.params.id.minus(BI_ONE).toString())
    entity.proposer = event.params.creator
    entity.start = event.params.start
    entity.end = event.params.start.plus(event.params.duration)
    entity.executor = event.params.executor
    entity.votes = []
    entity.voters = []
    entity.totalForVotes = BI_ZERO
    entity.totalAgainstVotes = BI_ZERO
    entity.open = true
    entity.save()
}

export function handleProposalFinished(event: ProposalFinished): void {
    let entity = Proposal.load(event.params.id.toString())
    entity.open = false
    entity.save()
}

export function handleRegisterVoter(event: RegisterVoter): void {
    let totalWeight = TotalWeight.load('0')
    if (totalWeight == null) {
        totalWeight = new TotalWeight('0')
        totalWeight.votersCount = BI_ZERO
    }

    let voter = Voter.load(event.params.voter.toHexString())
    if (voter == null) {
        voter = new Voter(event.params.voter.toHexString())
        voter.voteCount = BI_ZERO
        totalWeight.votersCount = totalWeight.votersCount.plus(BI_ONE)
    }

    voter.weight = event.params.votes
    totalWeight.totalWeight = event.params.totalVotes

    voter.save()
    totalWeight.save()
}

export function handleRevokeVoter(event: RevokeVoter): void {
    let totalWeight = TotalWeight.load('0')
    totalWeight.totalWeight = event.params.totalVotes
    totalWeight.save()

    let voter = new Voter(event.params.voter.toHexString())
    voter.weight = BI_ZERO
    voter.save()
}

export function handleVote(event: Vote): void {
    let prop = Proposal.load(event.params.id.toString());
    let propVotes = prop.votes

    let voter = Voter.load(event.params.voter.toHexString())
    if (voter == null) {
        voter = new Voter(event.params.voter.toHexString())
        voter.voteCount = BI_ZERO
        voter.weight = BI_ZERO

        let totalWeight = TotalWeight.load('0')
        if (totalWeight == null) {
            totalWeight = new TotalWeight('0')
            totalWeight.votersCount = BI_ZERO
        }
        totalWeight.votersCount = totalWeight.votersCount.plus(BI_ONE)
    }

    let voteId = generateVoteId(event, event.params.vote)
    let vote = VoteEntity.load(voteId)
    if (vote == null) {
        vote = new VoteEntity(voteId);
        vote.vote = event.params.vote
        vote.weight = BI_ZERO
        vote.voter = event.params.voter.toHexString()
        voter.voteCount = voter.voteCount.plus(BI_ONE)

        propVotes.push(vote.id)
    }
    vote.weight = vote.weight.plus(event.params.weight)

    let oppositeVoteId = generateVoteId(event, !event.params.vote)
    let oppositeVote = VoteEntity.load(oppositeVoteId)

    prop.votes = propVotes

    if (event.params.vote == true) {
        prop.totalForVotes = prop.totalForVotes.plus(vote.weight)
    } else {
        prop.totalAgainstVotes = prop.totalAgainstVotes.plus(vote.weight)
    }

    if (oppositeVote == null) {
        let propVoters = prop.voters
        propVoters.push(voter.id)
        prop.voters = propVoters
    } else {
        if (event.params.vote == true) {
            prop.totalAgainstVotes = prop.totalAgainstVotes.minus(oppositeVote.weight)
        } else {
            prop.totalForVotes = prop.totalForVotes.minus(oppositeVote.weight)
        }

        voter.voteCount = voter.voteCount.minus(BI_ONE)

        propVotes.splice(propVotes.indexOf(oppositeVoteId), 1)
        store.remove('Vote', oppositeVoteId)
    }

    vote.save()
    voter.save()
    prop.save()
}

export function handleStaked(event: Staked): void {
    let voter = Voter.load(event.params.user.toHexString())
    if (voter == null) {
        return
    }

    let totalStakedEntity = TotalWeight.load('0')
    if (totalStakedEntity == null) {
        totalStakedEntity = new TotalWeight('0')
        totalStakedEntity.totalWeight = BI_ZERO
    }
    voter.weight = voter.weight.plus(event.params.amount)
    totalStakedEntity.totalWeight = totalStakedEntity.totalWeight.plus(event.params.amount)
    voter.save()
    totalStakedEntity.save()
}

export function handleWithdrawn(event: Withdrawn): void {
    let voter = Voter.load(event.params.user.toHexString())
    if (voter == null) {
        return
    }

    let totalStakedEntity = TotalWeight.load('0')
    voter.weight = voter.weight.minus(event.params.amount)
    totalStakedEntity.totalWeight = totalStakedEntity.totalWeight.minus(event.params.amount)
    voter.save()
    totalStakedEntity.save()
}
