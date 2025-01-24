import { Buffer } from 'buffer';
import { MPCProtocol, MPCComputationType } from '../mpc';
import { Participant, Message } from '../types';

describe('MPC Protocol Performance Tests', () => {
  let protocols: MPCProtocol[];
  let participants: Participant[];
  let messages: Message[] = [];
  const NUM_PARTICIPANTS = 10;
  const BATCH_SIZE = 100;

  beforeEach(() => {
    messages = [];
    participants = [];
    protocols = [];

    // Create participants and protocols
    for (let i = 0; i < NUM_PARTICIPANTS; i++) {
      participants.push({
        id: `participant${i}`,
        publicKey: Buffer.from(`participant${i}-public-key`)
      });
      protocols.push(new MPCProtocol());
    }

    // Set up message handlers for all protocols
    protocols.forEach((protocol, i) => {
      protocol.onMessage(async (message) => {
        messages.push(message);
        // Forward message to all other participants
        for (let j = 0; j < NUM_PARTICIPANTS; j++) {
          if (j !== i && (message.receiver === '*' || message.receiver === participants[j].id)) {
            await protocols[j].sendMessage(message);
          }
        }
      });
    });
  });

  it('should measure computation time for different participant counts', async () => {
    const participantCounts = [3, 5, 7, 10];
    const results: { count: number; time: number }[] = [];

    for (const count of participantCounts) {
      const startTime = Date.now();

      // Initialize and start protocols
      await Promise.all(
        protocols.slice(0, count).map(protocol => protocol.initialize())
      );
      await Promise.all(
        protocols.slice(0, count).map(protocol => protocol.start())
      );

      // Create session
      const session = await protocols[0].createSession(participants.slice(0, count));
      await Promise.all(
        protocols.slice(1, count).map(protocol => protocol.joinSession(session.id))
      );

      // Set local values
      protocols.slice(0, count).forEach(protocol => {
        protocol.setLocalValue(Buffer.from([Math.floor(Math.random() * 100)]));
      });

      // Start computation
      await Promise.all(
        protocols.slice(0, count).map(protocol =>
          protocol.startComputation(MPCComputationType.SUM)
        )
      );

      // Wait for computation to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const endTime = Date.now();
      results.push({ count, time: endTime - startTime });

      // Verify all protocols completed successfully
      const allComplete = protocols
        .slice(0, count)
        .every(protocol => protocol.isComplete());
      expect(allComplete).toBe(true);
    }

    // Log performance results
    console.table(results);
  });

  it('should measure batch processing performance', async () => {
    const count = 5;
    const batchSizes = [10, 50, 100];
    const results: { batchSize: number; time: number; throughput: number }[] = [];

    for (const batchSize of batchSizes) {
      // Initialize and start protocols
      await Promise.all(
        protocols.slice(0, count).map(protocol => protocol.initialize())
      );
      await Promise.all(
        protocols.slice(0, count).map(protocol => protocol.start())
      );

      const startTime = Date.now();

      // Process multiple computations in batch
      for (let i = 0; i < batchSize; i++) {
        const session = await protocols[0].createSession(participants.slice(0, count));
        await Promise.all(
          protocols.slice(1, count).map(protocol => protocol.joinSession(session.id))
        );

        // Set random local values
        protocols.slice(0, count).forEach(protocol => {
          protocol.setLocalValue(Buffer.from([Math.floor(Math.random() * 100)]));
        });

        // Start computation
        await Promise.all(
          protocols.slice(0, count).map(protocol =>
            protocol.startComputation(MPCComputationType.SUM)
          )
        );
      }

      // Wait for all computations to complete
      await new Promise(resolve => setTimeout(resolve, batchSize * 20));

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      results.push({
        batchSize,
        time: totalTime,
        throughput: (batchSize / totalTime) * 1000 // operations per second
      });
    }

    // Log performance results
    console.table(results);
  });

  it('should measure message processing overhead', async () => {
    const count = 5;
    const messageCount = 1000;
    const startTime = Date.now();

    // Initialize and start protocols
    await Promise.all(
      protocols.slice(0, count).map(protocol => protocol.initialize())
    );
    await Promise.all(
      protocols.slice(0, count).map(protocol => protocol.start())
    );

    const session = await protocols[0].createSession(participants.slice(0, count));
    await Promise.all(
      protocols.slice(1, count).map(protocol => protocol.joinSession(session.id))
    );

    // Send test messages
    for (let i = 0; i < messageCount; i++) {
      const message: Message = {
        type: 'TEST',
        sender: participants[0].id,
        receiver: participants[1].id,
        content: Buffer.from([1]),
        timestamp: new Date()
      };
      await protocols[0].sendMessage(message);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const throughput = (messageCount / totalTime) * 1000; // messages per second

    console.log({
      messageCount,
      totalTime,
      throughput,
      averageLatency: totalTime / messageCount
    });
  });
}); 