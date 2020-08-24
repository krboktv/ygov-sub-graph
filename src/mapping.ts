import { BigInt, store } from "@graphprotocol/graph-ts"
import {
  Staked,
  Withdrawn,
  Vote,
  NewProposal,
  ProposalFinished, RegisterVoter, RevokeVoter
} from '../generated/Contract/Contract'
import { TotalWeight, Proposal, Vote as VoteEntity, Voter } from "../generated/schema"
import { BI_ZERO, BI_ONE, generateVoteId } from './helpers'

export function handleNewProposal(event: NewProposal): void {
  let entity = new Proposal(event.params.id.toString())
  entity.creator = event.params.creator
  entity.start = event.params.start
  entity.end = event.params.start.plus(event.params.duration)
  entity.executor = event.params.executor
  entity.votes = []
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
  let voter = new Voter(event.params.voter.toHexString())
  voter.voteCount = BI_ZERO
  voter.votes = []
  voter.weight = event.params.votes
  voter.save()

  let totalWeight = TotalWeight.load('0')
  if (totalWeight == null) {
    totalWeight = new TotalWeight('0')
    totalWeight.votersCount = BI_ZERO
  }
  totalWeight.totalWeight = event.params.totalVotes
  totalWeight.votersCount = totalWeight.votersCount.plus(BI_ONE)
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

  let vote = new VoteEntity(generateVoteId(event, event.params.vote));
  vote.proposal = prop.id
  vote.vote = event.params.vote
  vote.voter = event.params.voter.toHexString()
  vote.weight = event.params.weight

  let voter = Voter.load(event.params.voter.toHexString())
  voter.voteCount = voter.voteCount.plus(BI_ONE)

  let voterVotes = voter.votes
  voterVotes.push(vote.id)

  let propVotes = prop.votes
  propVotes.push(vote.id)

  let oppositeVoteId = generateVoteId(event, !event.params.vote)
  let oppositeVote = VoteEntity.load(oppositeVoteId)
  if (oppositeVote != null) {
    voterVotes = voterVotes.splice(voterVotes.indexOf(oppositeVoteId), 1)
    propVotes = propVotes.splice(propVotes.indexOf(oppositeVoteId), 1)
    voter.voteCount = voter.voteCount.minus(BI_ONE)
    store.remove('Vote', oppositeVoteId)
  } else {
    let propVoters = prop.voters
    propVoters.push(voter.id)
    prop.voters = propVoters
  }

  voter.votes = voterVotes
  prop.votes = propVotes

  if (event.params.vote == true) {
    prop.totalForVotes = prop.totalForVotes.plus(BI_ONE)
    if (oppositeVote != null) {
      prop.totalAgainstVotes = prop.totalAgainstVotes.minus(BI_ONE)
    }
  } else {
    prop.totalAgainstVotes = prop.totalAgainstVotes.plus(BI_ONE)
    if (oppositeVote != null) {
      prop.totalForVotes = prop.totalForVotes.minus(BI_ONE)
    }
  }

  prop.save()
  voter.save()
  vote.save()
}

export function handleStaked(event: Staked): void {
  let voter = Voter.load(event.params.user.toHexString())
  if (voter == null) {
    return
  }

  let totalStakedEntity = TotalWeight.load('0')
  if (totalStakedEntity == null) {
    totalStakedEntity = new  TotalWeight('0')
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
