import pytest
from app.services.breeth_memory import breeth_memory_service
from app.schemas.interview import CandidateProfileAnalysis

@pytest.mark.asyncio
async def test_breeth_memory_store_and_query_profile():
    profile = CandidateProfileAnalysis(
        profileId="cand_test_breeth",
        profileUrl="uploaded://test.pdf",
        profilePlatform="Resume Upload",
        candidateName="Garvit Sharma",
        analyzedAt="Aug 08, 2026",
        lastUpdatedAt="Aug 08, 2026",
        analysisVersion="3.0.0-test",
        headline="Frontend Engineer",
        summary="Experienced engineer in React and TypeScript.",
        targetRoles=["Frontend Engineer"],
        technicalSkills=["React", "TypeScript", "Python"],
        experience=["InterviewOS - Lead Frontend Dev"],
        projects=["Pavitra Step - IoT Health Monitor"],
        profileCompleteness=85
    )

    success = await breeth_memory_service.store_candidate_profile_memories("cand_test_breeth", profile)
    assert success is True

    memories = await breeth_memory_service.query_candidate_memories("cand_test_breeth", "React", top_k=5)
    assert len(memories) > 0
    assert any("React" in m for m in memories)

@pytest.mark.asyncio
async def test_breeth_memory_interview_turn_and_fallback():
    # Test storing interview turn memory
    stored = await breeth_memory_service.store_interview_turn_memory(
        candidate_id="cand_test_breeth",
        question="Explain how RAG retrieval works.",
        answer="RAG retrieves relevant documents from vector DB and passes context to LLM.",
        evaluation=type("Eval", (), {"score": 9.0, "feedback": "Great answer", "skillsTested": ["RAG", "Vector Search"]})
    )
    assert stored is True

    # Test query
    memories = await breeth_memory_service.query_candidate_memories("cand_test_breeth", "RAG", top_k=3)
    assert len(memories) > 0
    assert any("RAG" in m for m in memories)

@pytest.mark.asyncio
async def test_breeth_unavailable_graceful_fallback():
    # Query non-existent candidate or fallback mode
    memories = await breeth_memory_service.query_candidate_memories("non_existent_cand", "Python", top_k=3)
    assert isinstance(memories, list)
